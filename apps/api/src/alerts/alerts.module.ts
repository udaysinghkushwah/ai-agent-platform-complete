import { Module } from '@nestjs/common';
import { AlertRulesController, AlertEventsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  controllers: [AlertRulesController, AlertEventsController],
  providers: [AlertsService],
})
export class AlertsModule {}
