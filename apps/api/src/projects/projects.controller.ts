import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post('organizations/:orgId/projects')
  @MinRole('ADMIN')
  async create(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(orgId, user.id, dto);
  }

  @Get('organizations/:orgId/projects')
  @MinRole('VIEWER')
  async list(@Param('orgId') orgId: string) {
    return this.projects.listForOrganization(orgId);
  }

  // TenantGuard resolves :projectId -> organizationId internally and attaches
  // it as req.membership, so this route is tenant-safe even though no orgId
  // appears in the URL, and we get the organizationId back here for free
  // instead of re-deriving it.
  @Get('projects/:projectId')
  @MinRole('VIEWER')
  async getOne(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
  ) {
    return this.projects.getOneForOrganization(membership.organizationId, projectId);
  }

  @Patch('projects/:projectId/privacy-settings')
  @MinRole('SECURITY_REVIEWER')
  async updatePrivacySettings(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePrivacySettingsDto,
  ) {
    return this.projects.updatePrivacySettings(membership.organizationId, projectId, user.id, dto);
  }

  @Patch('projects/:projectId/integrations')
  @MinRole('ADMIN')
  async updateIntegrations(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { webhookUrl?: string; slackWebhookUrl?: string },
  ) {
    return this.projects.updateIntegrations(membership.organizationId, projectId, user.id, dto);
  }
}
