import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { PromptsService } from './prompts.service';
import { CreatePromptDto, CreatePromptVersionDto, UpdateVersionStatusDto } from './dto/versions.dto';
import { ExecuteSandboxPromptDto } from '../prompts/dto/sandbox.dto';

@Controller('projects/:projectId/prompts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @Post('sandbox/execute')
  @MinRole('VIEWER')
  async executeSandbox(
    @Param('projectId') projectId: string,
    @Body() dto: ExecuteSandboxPromptDto,
  ) {
    return this.prompts.executeSandbox(projectId, dto);
  }

  @Post()
  @MinRole('DEVELOPER')
  async create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromptDto,
  ) {
    return this.prompts.create(membership.organizationId, projectId, user.id, dto);
  }

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string) {
    return this.prompts.list(projectId);
  }

  @Post(':promptId/versions')
  @MinRole('DEVELOPER')
  async createVersion(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromptVersionDto,
  ) {
    return this.prompts.createVersion(membership.organizationId, projectId, promptId, user.id, dto);
  }

  @Get(':promptId/versions')
  @MinRole('VIEWER')
  async listVersions(@Param('projectId') projectId: string, @Param('promptId') promptId: string) {
    return this.prompts.listVersions(projectId, promptId);
  }

  @Patch(':promptId/versions/:versionId/status')
  @MinRole('ADMIN')
  async updateStatus(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('versionId') versionId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVersionStatusDto,
  ) {
    return this.prompts.updateVersionStatus(membership.organizationId, projectId, promptId, versionId, user.id, dto);
  }
}
