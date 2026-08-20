import { Prisma } from '@prisma/client';
import { prisma } from './processor';
import { sendAlertEmail } from './mailer';

type Comparator = 'GT' | 'GTE' | 'LT' | 'LTE';

function breaches(value: number, comparator: Comparator, threshold: number): boolean {
  switch (comparator) {
    case 'GT':
      return value > threshold;
    case 'GTE':
      return value >= threshold;
    case 'LT':
      return value < threshold;
    case 'LTE':
      return value <= threshold;
  }
}

async function computeMetric(
  projectId: string,
  metric: string,
  windowMinutes: number,
): Promise<number | null> {
  const since = new Date(Date.now() - windowMinutes * 60_000);

  switch (metric) {
    case 'ERROR_RATE': {
      const [total, errored] = await Promise.all([
        prisma.trace.count({ where: { projectId, startedAt: { gte: since } } }),
        prisma.trace.count({ where: { projectId, startedAt: { gte: since }, status: 'error' } }),
      ]);
      return total > 0 ? errored / total : null;
    }

    case 'LATENCY_P95': {
      const rows = await prisma.$queryRaw<{ p95: number | null }[]>(Prisma.sql`
        SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) * 1000) AS p95
        FROM traces
        WHERE "projectId" = ${projectId} AND "startedAt" >= ${since} AND "endedAt" IS NOT NULL
      `);
      const p95 = rows[0]?.p95;
      return p95 !== null && p95 !== undefined ? Number(p95) : null;
    }

    case 'COST': {
      const agg = await prisma.trace.aggregate({
        where: { projectId, startedAt: { gte: since } },
        _sum: { totalCost: true },
      });
      return agg._sum.totalCost !== null ? Number(agg._sum.totalCost) : null;
    }

    case 'TOOL_FAILURE_RATE': {
      // Governed by AuditEvent rows the API writes on every policy check
      // (see governance.service.ts's checkTool, which threads projectId
      // through specifically so this query can scope to one project).
      const rows = await prisma.$queryRaw<{ total: bigint; denied: bigint }[]>(Prisma.sql`
        SELECT
          count(*) AS total,
          count(*) FILTER (WHERE metadata->>'outcome' = 'DENIED') AS denied
        FROM audit_events
        WHERE action = 'tool_call.checked' AND "projectId" = ${projectId} AND "createdAt" >= ${since}
      `);
      const total = Number(rows[0]?.total ?? 0);
      const denied = Number(rows[0]?.denied ?? 0);
      return total > 0 ? denied / total : null;
    }

    case 'EVAL_SCORE': {
      const latest = await prisma.evaluationRun.findFirst({
        where: { projectId, status: 'COMPLETED', overallScore: { not: null } },
        orderBy: { completedAt: 'desc' },
      });
      return latest?.overallScore ?? null;
    }

    case 'EVAL_REGRESSION': {
      // Numeric encoding so a single comparator/threshold pair can express
      // "alert on FAIL" (GTE 1) or "alert on WARN or worse" (GTE 0.5).
      const latest = await prisma.regressionCheck.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      if (!latest) return null;
      return latest.verdict === 'FAIL' ? 1 : latest.verdict === 'WARN' ? 0.5 : 0;
    }

    default:
      return null;
  }
}

export async function checkAlertRules(): Promise<void> {
  const rules = await prisma.alertRule.findMany({ where: { status: 'ACTIVE' } });

  for (const rule of rules) {
    try {
      await evaluateRule(rule);
    } catch (err) {
      // One bad rule (e.g. a metric query edge case) should never take down
      // the whole check cycle for every other project's rules.
      console.error(`[alert-checker] failed evaluating rule ${rule.id}:`, err);
    }
  }
}

async function evaluateRule(rule: {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  metric: string;
  comparator: string;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  notifyEmails: string[];
}) {
  const value = await computeMetric(rule.projectId, rule.metric, rule.windowMinutes);

  const openEvent = await prisma.alertEvent.findFirst({
    where: { alertRuleId: rule.id, status: 'OPEN' },
    orderBy: { triggeredAt: 'desc' },
  });

  if (value === null) return; // not enough data to evaluate this window — neither trigger nor resolve

  const isBreached = breaches(value, rule.comparator as Comparator, rule.threshold);

  if (!isBreached) {
    if (openEvent) {
      await prisma.alertEvent.update({
        where: { id: openEvent.id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
    }
    return;
  }

  if (openEvent) {
    const cooldownElapsed = Date.now() - openEvent.triggeredAt.getTime() > rule.cooldownMinutes * 60_000;
    if (!cooldownElapsed) return; // still within cooldown — don't spam a second event
  }

  const message = `${rule.name}: ${rule.metric} is ${value.toFixed(3)} (threshold ${rule.comparator} ${rule.threshold}).`;

  const event = await prisma.alertEvent.create({
    data: {
      alertRuleId: rule.id,
      organizationId: rule.organizationId,
      projectId: rule.projectId,
      metricValue: value,
      threshold: rule.threshold,
      message,
      status: 'OPEN',
    },
  });

  const result = await sendAlertEmail(rule.notifyEmails, `[Alert] ${rule.name}`, message);
  await prisma.alertEvent.update({
    where: { id: event.id },
    data: { notified: result.sent, notifyError: result.error ?? null },
  });
}
