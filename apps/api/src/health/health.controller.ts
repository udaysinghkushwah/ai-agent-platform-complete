import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async checkHealth() {
    try {
      // 1. Check PostgreSQL DB connection
      await this.prisma.$queryRaw`SELECT 1`;

      // 2. Check Redis connection
      const ping = await this.redis.ping();

      return {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {
          database: 'UP',
          redis: ping === 'PONG' ? 'UP' : 'DOWN',
        },
      };
    } catch (err: any) {
      throw new ServiceUnavailableException({
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        error: err.message,
      });
    }
  }

  @Get('readiness')
  async checkReadiness() {
    return this.checkHealth();
  }
}
