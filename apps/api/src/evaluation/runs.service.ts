import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { DatasetsService } from './datasets.service';
import { CreateEvaluationRunDto } from './dto/create-run.dto';
import { EvaluatorConfig } from './evaluator-config.types';
import { EVALUATION_QUEUE } from './evaluation.constants';
import { BillingService } from '../billing/billing.service';

export interface EvaluationJobData {
  organizationId: string;
  projectId: string;
  runId: string;
  datasetCaseId: string;
  evaluators: EvaluatorConfig[];
  submittedOutput: unknown;
  submittedCost?: number;
}

@Injectable()
export class EvaluationRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly datasets: DatasetsService,
    private readonly billing: BillingService,
    @InjectQueue(EVALUATION_QUEUE) private readonly queue: Queue<EvaluationJobData>,
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    datasetId: string,
    userId: string,
    dto: CreateEvaluationRunDto,
  ) {
    await this.datasets.getOneOrThrow(projectId, datasetId);

    const cases = await this.prisma.datasetCase.findMany({ where: { datasetId } });
    const caseByKey = new Map(cases.map((c) => [c.caseKey, c]));

    const matched: { caseId: string; output: unknown; cost?: number }[] = [];
    const unknownKeys: string[] = [];
    for (const o of dto.outputs) {
      const match = caseByKey.get(o.caseKey);
      if (!match) {
        unknownKeys.push(o.caseKey);
      } else {
        matched.push({ caseId: match.id, output: o.output, cost: o.cost });
      }
    }

    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `These caseKeys don't exist in this dataset: ${unknownKeys.join(', ')}`,
      );
    }
    if (matched.length === 0) {
      throw new BadRequestException('No outputs to evaluate');
    }

    // Human-initiated, low-frequency action — a live Postgres aggregate here
    // is fine (unlike /ingest's hot path, which uses a Redis-cached counter
    // instead for exactly this reason).
    const quotaExceeded = await this.billing.isEvalQuotaExceeded(organizationId, matched.length);
    if (quotaExceeded) {
      throw new HttpException(
        'This would exceed your plan\'s monthly evaluation case limit. Upgrade your plan or wait for next month\'s reset.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const run = await this.prisma.evaluationRun.create({
      data: {
        organizationId,
        projectId,
        datasetId,
        name: dto.name,
        agentId: dto.agentId,
        agentVersion: dto.agentVersion,
        evaluatorConfig: dto.evaluators as any,
        status: 'QUEUED',
        totalCases: matched.length,
        createdBy: userId,
      },
    });

    await this.queue.addBulk(
      matched.map(({ caseId, output, cost }) => ({
        name: 'evaluate-case',
        data: {
          organizationId,
          projectId,
          runId: run.id,
          datasetCaseId: caseId,
          evaluators: dto.evaluators as EvaluatorConfig[],
          submittedOutput: output,
          submittedCost: cost,
        },
        opts: {
          // one job per (run, case) — safe to retry the create-run call
          // without double-scoring a case.
          jobId: `${run.id}:${caseId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 500,
          removeOnFail: 2000,
        },
      })),
    );

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'evaluation_run.created',
      resourceType: 'evaluation_run',
      resourceId: run.id,
      metadata: { datasetId, caseCount: matched.length },
    });

    return run;
  }

  async list(projectId: string, datasetId?: string) {
    return this.prisma.evaluationRun.findMany({
      where: { projectId, ...(datasetId ? { datasetId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOneWithResults(projectId: string, runId: string) {
    const run = await this.prisma.evaluationRun.findFirst({
      where: { id: runId, projectId },
      include: {
        results: {
          include: { datasetCase: { select: { caseKey: true, input: true, expectedOutput: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) throw new NotFoundException('Evaluation run not found');
    return run;
  }
}
