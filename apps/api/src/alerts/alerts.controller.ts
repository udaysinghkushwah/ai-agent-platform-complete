import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { AlertsService } from './alerts.service';
import { CreateAlertRuleDto, UpdateAlertEventStatusDto, UpdateAlertRuleStatusDto } from './dto/alerts.dto';

@Controller('projects/:projectId/alert-rules')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AlertRulesController {
  constructor(private readonly alerts: AlertsService) {}

  @Post()
  @MinRole('DEVELOPER')
  async create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAlertRuleDto,
  ) {
    return this.alerts.createRule(membership.organizationId, projectId, user.id, dto);
  }

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string) {
    return this.alerts.listRules(projectId);
  }

  @Patch(':ruleId/status')
  @MinRole('DEVELOPER')
  async updateStatus(
    @Param('projectId') projectId: string,
    @Param('ruleId') ruleId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAlertRuleStatusDto,
  ) {
    return this.alerts.updateRuleStatus(membership.organizationId, projectId, ruleId, user.id, dto);
  }
}

@Controller('projects/:projectId/alert-events')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AlertEventsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string, @Query('status') status?: string) {
    return this.alerts.listEvents(projectId, status);
  }

  @Patch(':eventId/status')
  @MinRole('DEVELOPER')
  async updateStatus(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAlertEventStatusDto,
  ) {
    return this.alerts.updateEventStatus(membership.organizationId, projectId, eventId, user.id, dto);
  }
}
