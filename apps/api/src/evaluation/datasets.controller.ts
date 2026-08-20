import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { DatasetsService } from './datasets.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { CreateDatasetCasesDto } from './dto/create-dataset-case.dto';

@Controller('projects/:projectId/datasets')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

  @Post()
  @MinRole('DEVELOPER')
  async create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDatasetDto,
  ) {
    return this.datasets.create(membership.organizationId, projectId, user.id, dto);
  }

  @Get()
  @MinRole('VIEWER')
  async list(@Param('projectId') projectId: string) {
    return this.datasets.list(projectId);
  }

  @Post(':datasetId/cases')
  @MinRole('DEVELOPER')
  async addCases(
    @Param('projectId') projectId: string,
    @Param('datasetId') datasetId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDatasetCasesDto,
  ) {
    return this.datasets.addCases(membership.organizationId, projectId, datasetId, user.id, dto);
  }

  @Get(':datasetId/cases')
  @MinRole('VIEWER')
  async listCases(@Param('projectId') projectId: string, @Param('datasetId') datasetId: string) {
    return this.datasets.listCases(projectId, datasetId);
  }
}
