import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { ApiKeyGuard } from './api-key.guard';
import { TELEMETRY_QUEUE } from './ingestion.constants';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BullModule.registerQueue({ name: TELEMETRY_QUEUE }), ApiKeysModule, BillingModule],
  controllers: [IngestionController],
  providers: [IngestionService, ApiKeyGuard],
})
export class IngestionModule {}
