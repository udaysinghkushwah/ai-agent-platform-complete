import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import { prisma } from './processor';
import { runEvaluator } from './evaluators';
import { EvaluatorConfig } from './evaluators/types';

export interface EvaluationJobData {
  organizationId: string;
  projectId: string;
  runId: string;
  datasetCaseId: string;
  evaluators: EvaluatorConfig[];
  submittedOutput: unknown;
  submittedCost?: number;
}

export async function processEvaluationJob(job: Job<EvaluationJobData>) {
  const { runId, datasetCaseId, evaluators, submittedOutput, submittedCost } = job.data;

  const datasetCase = await prisma.datasetCase.findUnique({ where: { id: datasetCaseId } });
  if (!datasetCase) {
    // Case was deleted after the run was created — record nothing, still
    // count it as "completed" so the run doesn't hang waiting forever for
    // a case that will never resolve.
    await incrementAndMaybeFinalize(runId, { degraded: false });
    return;
  }

  let anyDegraded = false;

  for (const evaluatorConfig of evaluators) {
    const result = await runEvaluator(evaluatorConfig, {
      submittedOutput,
      expectedOutput: datasetCase.expectedOutput,
      input: datasetCase.input,
      context: datasetCase.context,
    });

    if (result.degraded) anyDegraded = true;

    await prisma.evaluationResult.create({
      data: {
        evaluationRunId: runId,
        datasetCaseId,
        evaluatorType: evaluatorConfig.type,
        score: result.score,
        passed: result.passed,
        degraded: result.degraded,
        reasoning: result.reasoning,
        submittedOutput: submittedOutput as any,
        submittedCost,
        judgeModel: result.judgeModel,
      },
    });
  }

  await incrementAndMaybeFinalize(runId, { degraded: anyDegraded });
}

async function incrementAndMaybeFinalize(runId: string, { degraded }: { degraded: boolean }) {
  // Single atomic statement: bump completedCases (and degradedCases), flip
  // to RUNNING, and set startedAt only the first time it's still null — all
  // in one round trip, so there's no window where a second update could
  // race with itself.
  const rows = await prisma.$queryRaw<{ completedCases: number; totalCases: number }[]>(Prisma.sql`
    UPDATE evaluation_runs
    SET
      "completedCases" = "completedCases" + 1,
      "degradedCases" = "degradedCases" + ${degraded ? 1 : 0},
      status = 'RUNNING',
      "startedAt" = COALESCE("startedAt", now())
    WHERE id = ${runId}
    RETURNING "completedCases", "totalCases"
  `);

  const run = rows[0];
  if (!run) return;

  // completedCases strictly increases by exactly 1 per job, so exactly one
  // job's post-increment read ever sees this condition true — no extra
  // locking needed to avoid double-finalizing.
  if (run.completedCases >= run.totalCases) {
    await finalizeRun(runId);
  }
}

async function finalizeRun(runId: string) {
  const caseRows = await prisma.$queryRaw<
    {
      datasetCaseId: string;
      allPassed: boolean | null;
      allDegraded: boolean;
      avgScore: number | null;
      avgCost: number | null;
    }[]
  >(Prisma.sql`
    SELECT
      "datasetCaseId",
      bool_and(passed) FILTER (WHERE NOT degraded) AS "allPassed",
      bool_and(degraded) AS "allDegraded",
      avg(score) FILTER (WHERE NOT degraded) AS "avgScore",
      avg("submittedCost") AS "avgCost"
    FROM evaluation_results
    WHERE "evaluationRunId" = ${runId}
    GROUP BY "datasetCaseId"
  `);

  const consideredCases = caseRows.filter((r) => !r.allDegraded);
  const passedCases = consideredCases.filter((r) => r.allPassed === true);
  const casesWithCost = caseRows.filter((r) => r.avgCost !== null);

  const passRate = consideredCases.length > 0 ? passedCases.length / consideredCases.length : null;
  const overallScore =
    consideredCases.length > 0
      ? consideredCases.reduce((sum, r) => sum + (r.avgScore ?? 0), 0) / consideredCases.length
      : null;
  const avgCostPerCase =
    casesWithCost.length > 0
      ? casesWithCost.reduce((sum, r) => sum + (r.avgCost ?? 0), 0) / casesWithCost.length
      : null;

  const verdict =
    passRate === null ? null : passRate >= 0.9 ? 'PASS' : passRate >= 0.7 ? 'WARN' : 'FAIL';
  const status = consideredCases.length === 0 ? 'FAILED' : 'COMPLETED';

  await prisma.evaluationRun.update({
    where: { id: runId },
    data: {
      status,
      verdict: verdict as any,
      passRate,
      overallScore,
      avgCostPerCase,
      completedAt: new Date(),
    },
  });
}
