import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { MinRole } from '../common/decorators/roles.decorator';
import { BillingService } from './billing.service';

@Controller('organizations/:orgId/usage')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @MinRole('VIEWER')
  async getUsage(@Param('orgId') orgId: string) {
    return this.billing.getUsage(orgId);
  }
}
