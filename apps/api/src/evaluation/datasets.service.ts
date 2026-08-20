import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { CreateDatasetCasesDto } from './dto/create-dataset-case.dto';

@Injectable()
export class DatasetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, projectId: string, userId: string, dto: CreateDatasetDto) {
    const existing = await this.prisma.dataset.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException('A dataset with this name already exists in this project');
    }

    const dataset = await this.prisma.dataset.create({
      data: { organizationId, projectId, name: dto.name, description: dto.description },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'dataset.created',
      resourceType: 'dataset',
      resourceId: dataset.id,
      metadata: { name: dataset.name },
    });

    return dataset;
  }

  async list(projectId: string) {
    const datasets = await this.prisma.dataset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { cases: true, runs: true } } },
    });
    return datasets.map((d) => ({
      ...d,
      caseCount: d._count.cases,
      runCount: d._count.runs,
      _count: undefined,
    }));
  }

  async getOneOrThrow(projectId: string, datasetId: string) {
    const dataset = await this.prisma.dataset.findFirst({ where: { id: datasetId, projectId } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    return dataset;
  }

  async addCases(
    organizationId: string,
    projectId: string,
    datasetId: string,
    userId: string,
    dto: CreateDatasetCasesDto,
  ) {
    await this.getOneOrThrow(projectId, datasetId);

    // Upsert on (datasetId, caseKey) so re-importing the same CSV/JSON to
    // fix a typo updates the case in place instead of erroring or
    // duplicating it.
    const results = await this.prisma.$transaction(
      dto.cases.map((c) =>
        this.prisma.datasetCase.upsert({
          where: { datasetId_caseKey: { datasetId, caseKey: c.caseKey } },
          create: {
            datasetId,
            caseKey: c.caseKey,
            input: c.input as any,
            expectedOutput: c.expectedOutput as any,
            context: c.context as any,
            metadata: c.metadata as any,
            tags: c.tags ?? [],
          },
          update: {
            input: c.input as any,
            expectedOutput: c.expectedOutput as any,
            context: c.context as any,
            metadata: c.metadata as any,
            tags: c.tags ?? [],
          },
        }),
      ),
    );

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'dataset.cases_added',
      resourceType: 'dataset',
      resourceId: datasetId,
      metadata: { count: results.length },
    });

    return { upserted: results.length };
  }

  async listCases(projectId: string, datasetId: string) {
    await this.getOneOrThrow(projectId, datasetId);
    return this.prisma.datasetCase.findMany({
      where: { datasetId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
