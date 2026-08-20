import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { getPlanLimits, startOfCurrentMonth } from './plans';

const KEY_TTL_SECONDS = 40 * 24 * 60 * 60; // comfortably past a month, self-cleans if never touched again

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Why this exists rather than a live Postgres COUNT on the ingest path:
 * /ingest is explicitly designed to never block on a synchronous DB write
 * (see ingestion.service.ts) — a COUNT query on every request, however
 * cheap, is still a Postgres round trip on the hot path that endpoint was
 * built to avoid. Redis INCR is that same category of "already-paying-for-
 * a-round-trip" cost (the request already talks to Redis to enqueue the
 * BullMQ job), so it doesn't add a new dependency to the fast path.
 *
 * Seeding: if Redis was ever flushed/restarted mid-month, blindly trusting
 * an absent key as "zero usage" would let a customer burn through their
 * quota again for free. The first touch of a given org+month key seeds it
 * from the real Postgres count once, then increments happen in Redis only.
 */
@Injectable()
export class QuotaService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async checkAndIncrementTraceUsage(
    organizationId: string,
    count: number,
  ): Promise<{ allowed: boolean; currentUsage: number; limit: number }> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    const limits = getPlanLimits(org?.plan ?? 'free');
    const key = `usage:traces:${organizationId}:${monthKey(new Date())}`;

    await this.seedIfMissing(key, organizationId);

    const current = Number((await this.redis.get(key)) ?? 0);
    if (current >= limits.maxTracesPerMonth) {
      return { allowed: false, currentUsage: current, limit: limits.maxTracesPerMonth };
    }

    const updated = await this.redis.incrby(key, count);
    return { allowed: true, currentUsage: updated, limit: limits.maxTracesPerMonth };
  }

  private async seedIfMissing(key: string, organizationId: string): Promise<void> {
    const exists = await this.redis.exists(key);
    if (exists) return;

    const trueCount = await this.prisma.trace.count({
      where: { organizationId, startedAt: { gte: startOfCurrentMonth() } },
    });
    // NX so a concurrent request that also found the key missing doesn't
    // clobber the other's seed value with a slightly-stale count.
    await this.redis.set(key, trueCount, 'EX', KEY_TTL_SECONDS, 'NX');
  }
}
