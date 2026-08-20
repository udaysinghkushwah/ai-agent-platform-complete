import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { RegressionPoliciesService } from './regression-policies.service';
import { RegressionChecksService } from './regression-checks.service';
import { CreateRegressionPolicyDto, CreateRegressionCheckDto } from './dto/regression.dto';

@Controller('projects/:projectId/regression-policies')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RegressionPoliciesController {
  constructor(private readonly policies: RegressionPoliciesService) {}

  @Post()
  @MinRole('ADMIN')
  async create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRegressionPolicyDto,
  ) {
    return this.policies.create(membership.organizationId, projectId, user.id, dto);
  }

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string) {
    return this.policies.list(projectId);
  }
}

@Controller('projects/:projectId/regression-checks')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RegressionChecksController {
  constructor(private readonly checks: RegressionChecksService) {}

  @Post()
  @MinRole('DEVELOPER')
  async create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRegressionCheckDto,
  ) {
    return this.checks.create(membership.organizationId, projectId, user.id, dto);
  }

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string) {
    return this.checks.list(projectId);
  }

  @Get(':checkId')
  @MinRole('VIEWER')
  async getOne(@Param('projectId') projectId: string, @Param('checkId') checkId: string) {
    return this.checks.getOne(projectId, checkId);
  }
}
