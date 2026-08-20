import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { ApiKeyGuard } from '../ingestion/api-key.guard';
import { CurrentApiKeyContext } from '../ingestion/current-api-key-context.decorator';
import { ApiKeyContext } from '../ingestion/api-key.guard';
import { GovernanceService } from './governance.service';
import { CreateGovernancePolicyDto, PolicyCheckDto, UpdatePolicyStatusDto } from './dto/governance.dto';

@Controller('projects/:projectId/governance-policies')
@UseGuards(JwtAuthGuard, TenantGuard)
export class GovernancePoliciesController {
  constructor(private readonly governance: GovernanceService) {}

  @Post()
  @MinRole('SECURITY_REVIEWER')
  async create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGovernancePolicyDto,
  ) {
    return this.governance.createPolicy(membership.organizationId, projectId, user.id, dto);
  }

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string) {
    return this.governance.listPolicies(projectId);
  }

  @Patch(':policyId/status')
  @MinRole('SECURITY_REVIEWER')
  async updateStatus(
    @Param('projectId') projectId: string,
    @Param('policyId') policyId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePolicyStatusDto,
  ) {
    return this.governance.updateStatus(membership.organizationId, projectId, policyId, user.id, dto);
  }
}

@Controller('projects/:projectId/approvals')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ApprovalsController {
  constructor(private readonly governance: GovernanceService) {}

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string) {
    return this.governance.listApprovals(projectId);
  }

  @Post(':approvalId/resolve')
  @MinRole('SECURITY_REVIEWER')
  async resolve(
    @Param('projectId') projectId: string,
    @Param('approvalId') approvalId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { action: 'APPROVE' | 'REJECT' },
  ) {
    return this.governance.resolveApproval(membership.organizationId, projectId, approvalId, user.id, body.action);
  }
}

// Deliberately its own controller with its own guard: this endpoint is
// called by the customer's agent runtime, not a logged-in human, so it
// authenticates like /ingest does (API key), not like the routes above.
// No :projectId in the path, same reasoning as /ingest — the key itself
// determines the project; a path param here would be misleading (unused
// for scoping) at best and a spoofing vector at worst if a future edit
// accidentally trusted it instead of the authenticated context.
@Controller('policy-checks')
@UseGuards(ApiKeyGuard)
export class PolicyChecksController {
  constructor(private readonly governance: GovernanceService) {}

  @Post()
  async check(@CurrentApiKeyContext() apiKeyContext: ApiKeyContext, @Body() dto: PolicyCheckDto) {
    return this.governance.checkTool(
      apiKeyContext.organizationId,
      apiKeyContext.projectId,
      apiKeyContext.apiKeyId,
      dto,
    );
  }

  @Get('approvals/:approvalId/status')
  async getApprovalStatus(@Param('approvalId') approvalId: string) {
    return this.governance.getApprovalStatus(approvalId);
  }
}
