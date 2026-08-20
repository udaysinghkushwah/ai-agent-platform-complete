import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatasetsController } from './datasets.controller';
import { DatasetsService } from './datasets.service';
import { EvaluationRunsController } from './runs.controller';
import { EvaluationRunsService } from './runs.service';
import { EVALUATION_QUEUE } from './evaluation.constants';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BullModule.registerQueue({ name: EVALUATION_QUEUE }), BillingModule],
  controllers: [DatasetsController, EvaluationRunsController],
  providers: [DatasetsService, EvaluationRunsService],
})
export class EvaluationModule {}
