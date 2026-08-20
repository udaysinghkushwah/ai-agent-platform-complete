import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateRegressionPolicyDto } from './dto/regression.dto';

@Injectable()
export class RegressionPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, projectId: string, userId: string, dto: CreateRegressionPolicyDto) {
    const existing = await this.prisma.regressionPolicy.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) throw new ConflictException('A regression policy with this name already exists');

    if (dto.isDefault) {
      // Only one default policy per project — clear the flag on whatever
      // currently holds it before this one takes over.
      await this.prisma.regressionPolicy.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const policy = await this.prisma.regressionPolicy.create({
      data: {
        organizationId,
        projectId,
        name: dto.name,
        criticalEvaluators: dto.criticalEvaluators ?? [],
        maxPassRateDrop: dto.maxPassRateDrop ?? 0.05,
        warnPassRateDrop: dto.warnPassRateDrop ?? 0.02,
        maxCostIncreasePct: dto.maxCostIncreasePct ?? 0.2,
        isDefault: dto.isDefault ?? false,
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'regression_policy.created',
      resourceType: 'regression_policy',
      resourceId: policy.id,
      metadata: { name: policy.name },
    });

    return policy;
  }

  async list(projectId: string) {
    return this.prisma.regressionPolicy.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }
}
