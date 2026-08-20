import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { AgentVersionsService } from './agent-versions.service';
import { CreateAgentVersionDto, UpdateVersionStatusDto } from './dto/versions.dto';

@Controller('projects/:projectId/agent-versions')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AgentVersionsController {
  constructor(private readonly agentVersions: AgentVersionsService) {}

  @Post()
  @MinRole('DEVELOPER')
  async create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAgentVersionDto,
  ) {
    return this.agentVersions.create(membership.organizationId, projectId, user.id, dto);
  }

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string, @Query('agentId') agentId?: string) {
    return this.agentVersions.list(projectId, agentId);
  }

  @Patch(':versionId/status')
  @MinRole('ADMIN')
  async updateStatus(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVersionStatusDto,
  ) {
    return this.agentVersions.updateStatus(membership.organizationId, projectId, versionId, user.id, dto);
  }
}
