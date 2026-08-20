import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateRegressionCheckDto } from './dto/regression.dto';

const DEFAULT_POLICY = {
  criticalEvaluators: [] as string[],
  maxPassRateDrop: 0.05,
  warnPassRateDrop: 0.02,
  maxCostIncreasePct: 0.2,
};

@Injectable()
export class RegressionChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, projectId: string, userId: string, dto: CreateRegressionCheckDto) {
    const [baseline, candidate] = await Promise.all([
      this.prisma.evaluationRun.findFirst({ where: { id: dto.baselineRunId, projectId } }),
      this.prisma.evaluationRun.findFirst({ where: { id: dto.candidateRunId, projectId } }),
    ]);

    if (!baseline || !candidate) {
      throw new NotFoundException('Baseline or candidate evaluation run not found');
    }
    if (baseline.status !== 'COMPLETED' || candidate.status !== 'COMPLETED') {
      throw new BadRequestException('Both runs must be COMPLETED before they can be compared');
    }
    if (baseline.datasetId !== candidate.datasetId) {
      throw new BadRequestException(
        'Baseline and candidate must be runs of the same dataset for the comparison to be meaningful',
      );
    }

    const policy = dto.policyId
      ? await this.prisma.regressionPolicy.findFirst({ where: { id: dto.policyId, projectId } })
      : await this.prisma.regressionPolicy.findFirst({ where: { projectId, isDefault: true } });

    if (dto.policyId && !policy) {
      throw new NotFoundException('Regression policy not found');
    }

    const effectivePolicy = policy ?? DEFAULT_POLICY;

    const criticalFailures =
      effectivePolicy.criticalEvaluators.length > 0
        ? await this.prisma.evaluationResult.findMany({
            where: {
              evaluationRunId: candidate.id,
              evaluatorType: { in: effectivePolicy.criticalEvaluators as any },
              passed: false,
              degraded: false,
            },
            include: { datasetCase: { select: { caseKey: true } } },
          })
        : [];

    const passRateDelta =
      baseline.passRate !== null && candidate.passRate !== null ? candidate.passRate - baseline.passRate : null;

    const costIncreasePct =
      baseline.avgCostPerCase && candidate.avgCostPerCase
        ? (candidate.avgCostPerCase - baseline.avgCostPerCase) / baseline.avgCostPerCase
        : null;

    const { verdict, reasoning } = this.decide(
      effectivePolicy,
      criticalFailures.length,
      passRateDelta,
      costIncreasePct,
    );

    const check = await this.prisma.regressionCheck.create({
      data: {
        organizationId,
        projectId,
        policyId: policy?.id,
        baselineRunId: baseline.id,
        candidateRunId: candidate.id,
        verdict: verdict as any,
        baselinePassRate: baseline.passRate,
        candidatePassRate: candidate.passRate,
        passRateDelta,
        baselineCostPerCase: baseline.avgCostPerCase,
        candidateCostPerCase: candidate.avgCostPerCase,
        costIncreasePct,
        criticalFailures: criticalFailures.map((f) => ({
          caseKey: f.datasetCase.caseKey,
          evaluatorType: f.evaluatorType,
          reasoning: f.reasoning,
        })) as any,
        reasoning,
        createdBy: userId,
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'regression_check.created',
      resourceType: 'regression_check',
      resourceId: check.id,
      metadata: { baselineRunId: baseline.id, candidateRunId: candidate.id, verdict },
    });

    return check;
  }

  private decide(
    policy: { maxPassRateDrop: number; warnPassRateDrop: number; maxCostIncreasePct: number },
    criticalFailureCount: number,
    passRateDelta: number | null,
    costIncreasePct: number | null,
  ): { verdict: 'PASS' | 'WARN' | 'FAIL'; reasoning: string } {
    if (criticalFailureCount > 0) {
      return {
        verdict: 'FAIL',
        reasoning: `${criticalFailureCount} case(s) failed a critical evaluator — this alone fails the check regardless of aggregate pass rate.`,
      };
    }

    if (passRateDelta === null) {
      return {
        verdict: 'WARN',
        reasoning:
          'Pass rate could not be compared (one or both runs had no scoreable cases) — review manually before shipping.',
      };
    }

    if (passRateDelta <= -policy.maxPassRateDrop) {
      return {
        verdict: 'FAIL',
        reasoning: `Pass rate dropped ${(Math.abs(passRateDelta) * 100).toFixed(1)} points versus baseline, exceeding the ${(policy.maxPassRateDrop * 100).toFixed(1)}-point fail threshold.`,
      };
    }

    if (passRateDelta <= -policy.warnPassRateDrop) {
      return {
        verdict: 'WARN',
        reasoning: `Pass rate dropped ${(Math.abs(passRateDelta) * 100).toFixed(1)} points versus baseline — within tolerance but worth a look.`,
      };
    }

    if (costIncreasePct !== null && costIncreasePct >= policy.maxCostIncreasePct) {
      return {
        verdict: 'WARN',
        reasoning: `Cost per case increased ${(costIncreasePct * 100).toFixed(1)}%, exceeding the ${(policy.maxCostIncreasePct * 100).toFixed(1)}% warn threshold. Quality held, but this will show up in the bill.`,
      };
    }

    return {
      verdict: 'PASS',
      reasoning: 'No critical failures, pass rate held within tolerance, cost within tolerance.',
    };
  }

  async list(projectId: string) {
    return this.prisma.regressionCheck.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  async getOne(projectId: string, checkId: string) {
    const check = await this.prisma.regressionCheck.findFirst({ where: { id: checkId, projectId } });
    if (!check) throw new NotFoundException('Regression check not found');
    return check;
  }
}
