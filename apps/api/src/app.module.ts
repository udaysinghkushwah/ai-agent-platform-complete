import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { VersionsModule } from './versions/versions.module';
import { RegressionModule } from './regression/regression.module';
import { GovernanceModule } from './governance/governance.module';
import { AlertsModule } from './alerts/alerts.module';
import { AuditReadModule } from './audit/audit.module';
import { RedisModule } from './common/redis/redis.module';
import { BillingModule } from './billing/billing.module';
import { NotificationModule } from './notifications/notification.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL', 'redis://localhost:6379') },
      }),
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    ApiKeysModule,
    IngestionModule,
    AnalyticsModule,
    EvaluationModule,
    VersionsModule,
    RegressionModule,
    GovernanceModule,
    AlertsModule,
    AuditReadModule,
    BillingModule,
    NotificationModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
