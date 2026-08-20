import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { EvaluationRunsService } from './runs.service';
import { CreateEvaluationRunDto } from './dto/create-run.dto';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, TenantGuard)
export class EvaluationRunsController {
  constructor(private readonly runs: EvaluationRunsService) {}

  @Post('datasets/:datasetId/runs')
  @MinRole('DEVELOPER')
  async create(
    @Param('projectId') projectId: string,
    @Param('datasetId') datasetId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEvaluationRunDto,
  ) {
    return this.runs.create(membership.organizationId, projectId, datasetId, user.id, dto);
  }

  @Get('runs')
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string, @Query('datasetId') datasetId?: string) {
    return this.runs.list(projectId, datasetId);
  }

  @Get('runs/:runId')
  @MinRole('VIEWER')
  async getOne(@Param('projectId') projectId: string, @Param('runId') runId: string) {
    return this.runs.getOneWithResults(projectId, runId);
  }
}
