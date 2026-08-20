import { Module } from '@nestjs/common';
import { RegressionPoliciesController, RegressionChecksController } from './regression.controller';
import { RegressionPoliciesService } from './regression-policies.service';
import { RegressionChecksService } from './regression-checks.service';

@Module({
  controllers: [RegressionPoliciesController, RegressionChecksController],
  providers: [RegressionPoliciesService, RegressionChecksService],
})
export class RegressionModule {}
