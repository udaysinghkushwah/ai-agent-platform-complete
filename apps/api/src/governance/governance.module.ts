import { Module } from '@nestjs/common';
import { GovernancePoliciesController, PolicyChecksController, ApprovalsController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { NotificationModule } from '../notifications/notification.module';
import { ApiKeyGuard } from '../ingestion/api-key.guard';

@Module({
  imports: [ApiKeysModule, NotificationModule],
  controllers: [GovernancePoliciesController, PolicyChecksController, ApprovalsController],
  providers: [GovernanceService, ApiKeyGuard],
})
export class GovernanceModule {}
