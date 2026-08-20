import { Inject, Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { TraceQueryDto } from './dto/trace-query.dto';

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

interface LatencyPercentiles {
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  streamTraces(projectId: string): Observable<MessageEvent> {
    const channel = `trace_stream:${projectId}`;
    const subscriber = this.redis.duplicate();

    return new Observable<MessageEvent>((observer) => {
      subscriber.subscribe(channel, (err) => {
        if (err) observer.error(err);
      });

      subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            const data = JSON.parse(message);
            observer.next({ data });
          } catch {
            // silent catch on parse error
          }
        }
      });

      return () => {
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.disconnect();
      };
    });
  }

  private resolveRange(query: { from?: string; to?: string }) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS);
    return { from, to };
  }

  async getSummary(projectId: string, query: SummaryQueryDto) {
    const { from, to } = this.resolveRange(query);

    const [totals, latency, topModels, topFailingAgents] = await Promise.all([
      this.getTotals(projectId, from, to),
      this.getLatencyPercentiles(projectId, from, to),
      this.getTopModels(projectId, from, to),
      this.getTopFailingAgents(projectId, from, to),
    ]);

    return {
      range: { from, to },
      requests: totals.requestCount,
      errorRate: totals.requestCount > 0 ? totals.errorCount / totals.requestCount : 0,
      latencyMs: latency,
      totalCost: totals.totalCost,
      totalInputTokens: totals.totalInputTokens,
      totalOutputTokens: totals.totalOutputTokens,
      topModels,
      topFailingAgents,
    };
  }

  private async getTotals(projectId: string, from: Date, to: Date) {
    const [agg, errorAgg] = await Promise.all([
      this.prisma.trace.aggregate({
        where: { projectId, startedAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { totalCost: true, totalInputTokens: true, totalOutputTokens: true },
      }),
      this.prisma.trace.count({
        where: { projectId, startedAt: { gte: from, lte: to }, status: 'error' },
      }),
    ]);

    return {
      requestCount: agg._count._all,
      errorCount: errorAgg,
      totalCost: agg._sum.totalCost ? Number(agg._sum.totalCost) : 0,
      totalInputTokens: agg._sum.totalInputTokens ?? 0,
      totalOutputTokens: agg._sum.totalOutputTokens ?? 0,
    };
  }

  // percentile_cont has no Prisma query-builder equivalent, so this is one
  // of the few places raw SQL is the right tool. Parameterized via
  // Prisma.sql, never string concatenation.
  private async getLatencyPercentiles(
    projectId: string,
    from: Date,
    to: Date,
  ): Promise<LatencyPercentiles> {
    const rows = await this.prisma.$queryRaw<
      { p50: number | null; p95: number | null; p99: number | null }[]
    >(Prisma.sql`
      SELECT
        percentile_cont(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) * 1000) AS p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) * 1000) AS p95,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) * 1000) AS p99
      FROM traces
      WHERE "projectId" = ${projectId}
        AND "startedAt" >= ${from}
        AND "startedAt" <= ${to}
        AND "endedAt" IS NOT NULL
    `);

    const row = rows[0];
    return {
      p50: row?.p50 !== null && row?.p50 !== undefined ? Math.round(Number(row.p50)) : null,
      p95: row?.p95 !== null && row?.p95 !== undefined ? Math.round(Number(row.p95)) : null,
      p99: row?.p99 !== null && row?.p99 !== undefined ? Math.round(Number(row.p99)) : null,
    };
  }

  private async getTopModels(projectId: string, from: Date, to: Date) {
    const rows = await this.prisma.span.groupBy({
      by: ['model'],
      where: { projectId, startedAt: { gte: from, lte: to }, model: { not: null } },
      _count: { _all: true },
      _sum: { cost: true },
      orderBy: { _count: { model: 'desc' } },
      take: 5,
    });

    return rows.map((r) => ({
      model: r.model,
      requestCount: r._count._all,
      totalCost: r._sum.cost ? Number(r._sum.cost) : 0,
    }));
  }

  private async getTopFailingAgents(projectId: string, from: Date, to: Date) {
    const rows = await this.prisma.trace.groupBy({
      by: ['agentId'],
      where: {
        projectId,
        startedAt: { gte: from, lte: to },
        status: 'error',
        agentId: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { agentId: 'desc' } },
      take: 5,
    });

    return rows.map((r) => ({ agentId: r.agentId, errorCount: r._count._all }));
  }

  async listTraces(projectId: string, query: TraceQueryDto) {
    const { from, to } = this.resolveRange(query);
    const limit = query.limit ?? 25;

    const where: Prisma.TraceWhereInput = {
      projectId,
      startedAt: { gte: from, lte: to },
      ...(query.status ? { status: query.status } : {}),
      ...(query.agentId ? { agentId: query.agentId } : {}),
      ...(query.environment ? { environment: query.environment } : {}),
      ...(query.search
        ? {
            OR: [
              { traceId: { contains: query.search, mode: 'insensitive' } },
              { sessionId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const traces = await this.prisma.trace.findMany({
      where,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, // fetch one extra to know if there's a next page
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      include: { _count: { select: { spans: true } } },
    });

    const hasMore = traces.length > limit;
    const page = hasMore ? traces.slice(0, limit) : traces;

    return {
      items: page.map((t) => ({
        id: t.id,
        traceId: t.traceId,
        sessionId: t.sessionId,
        agentId: t.agentId,
        agentVersion: t.agentVersion,
        environment: t.environment,
        status: t.status,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        spanCount: t._count.spans,
        totalCost: t.totalCost ? Number(t.totalCost) : 0,
        totalInputTokens: t.totalInputTokens,
        totalOutputTokens: t.totalOutputTokens,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getTraceDetail(projectId: string, traceId: string) {
    // :traceId in the route is our internal Trace.id, not the SDK-supplied
    // traceId string — the list endpoint above returns `id` for this reason.
    const trace = await this.prisma.trace.findFirst({
      where: { id: traceId, projectId },
      include: { spans: { orderBy: { startedAt: 'asc' } } },
    });

    if (!trace) {
      throw new NotFoundException('Trace not found');
    }

    return {
      ...trace,
      totalCost: trace.totalCost ? Number(trace.totalCost) : 0,
      spans: trace.spans.map((s) => ({
        ...s,
        cost: s.cost ? Number(s.cost) : null,
      })),
    };
  }

  async semanticSearchTraces(projectId: string, query: string) {
    if (!query || !query.trim()) {
      return this.listTraces(projectId, {});
    }

    const queryTokens = new Set(
      query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean),
    );

    const traces = await this.prisma.trace.findMany({
      where: { projectId },
      include: {
        spans: {
          select: {
            name: true,
            eventType: true,
            model: true,
            status: true,
            errorMessage: true,
            metadata: true,
          },
        },
      },
      take: 100,
    });

    const scored = traces.map((trace) => {
      const corpusText = [
        trace.agentId || '',
        trace.agentVersion || '',
        trace.environment || '',
        ...trace.spans.map(
          (s) => `${s.name} ${s.eventType} ${s.model || ''} ${s.errorMessage || ''} ${JSON.stringify(s.metadata || {})}`,
        ),
      ]
        .join(' ')
        .toLowerCase();

      const corpusTokens = new Set(
        corpusText.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean),
      );

      let hits = 0;
      for (const t of queryTokens) {
        if (corpusTokens.has(t)) hits++;
      }

      const score = queryTokens.size > 0 ? hits / queryTokens.size : 0;
      return { trace, score };
    });

    const filtered = scored.filter((item) => item.score > 0);
    filtered.sort((a, b) => b.score - a.score);

    return {
      query,
      totalMatches: filtered.length,
      items: filtered.slice(0, 50).map(({ trace, score }) => ({
        id: trace.id,
        traceId: trace.traceId,
        sessionId: trace.sessionId,
        agentId: trace.agentId,
        agentVersion: trace.agentVersion,
        environment: trace.environment,
        status: trace.status,
        startedAt: trace.startedAt,
        endedAt: trace.endedAt,
        spanCount: trace.spans.length,
        totalCost: Number(trace.totalCost || 0),
        similarityScore: Number((score * 100).toFixed(1)),
      })),
    };
  }
}
