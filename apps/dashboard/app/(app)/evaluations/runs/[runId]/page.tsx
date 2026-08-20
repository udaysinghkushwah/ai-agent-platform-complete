'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/lib/session';
import { evaluation, EvaluationRunDetail, EvaluationResultItem, ApiError } from '@/lib/api';
import { RequireProject } from '@/components/RequireProject';
import { RunStatusBadge, VerdictBadge } from '@/components/EvaluationBadges';
import { StatCard } from '@/components/StatCard';
import { formatPercent, formatTime } from '@/lib/format';

function groupByCaseKey(results: EvaluationResultItem[]) {
  const map = new Map<string, EvaluationResultItem[]>();
  for (const r of results) {
    const key = r.datasetCase.caseKey;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries());
}

function RunDetailContent({ runId }: { runId: string }) {
  const { projectId } = useSession();
  const [run, setRun] = useState<EvaluationRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await evaluation.runDetail(projectId!, runId);
        if (cancelled) return;
        setRun(data);
        // Still in flight — poll again shortly instead of making the user
        // manually refresh to see a run finish.
        if (data.status === 'QUEUED' || data.status === 'RUNNING') {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load run');
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [projectId, runId]);

  if (error) return <p className="p-8 text-sm text-error">{error}</p>;
  if (!run) return <p className="p-8 text-sm text-textMuted">Loading…</p>;

  const grouped = groupByCaseKey(run.results);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-text">{run.name ?? `Run ${run.id.slice(0, 8)}`}</h1>
          <RunStatusBadge status={run.status} />
          <VerdictBadge verdict={run.verdict} />
        </div>
        <p className="mt-1 text-xs text-textFaint">
          Started {formatTime(run.createdAt)}
          {run.completedAt && ` · completed ${formatTime(run.completedAt)}`}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pass rate"
          value={run.passRate !== null ? formatPercent(run.passRate) : '—'}
          tone={run.verdict === 'FAIL' ? 'error' : run.verdict === 'PASS' ? 'ok' : 'default'}
        />
        <StatCard label="Overall score" value={run.overallScore !== null ? run.overallScore.toFixed(2) : '—'} />
        <StatCard label="Cases" value={`${run.completedCases}/${run.totalCases}`} />
        <StatCard
          label="Degraded"
          value={String(run.degradedCases)}
          sublabel={run.degradedCases > 0 ? 'evaluator errors excluded from score' : undefined}
          tone={run.degradedCases > 0 ? 'error' : 'default'}
        />
      </div>

      {(run.status === 'QUEUED' || run.status === 'RUNNING') && (
        <p className="mb-4 text-sm text-textMuted">Scoring in progress — this page updates automatically.</p>
      )}

      <h2 className="mb-3 text-sm font-medium text-text">Results by case</h2>
      <div className="space-y-3">
        {grouped.map(([caseKey, results]) => {
          const allPassed = results.every((r) => r.degraded || r.passed);
          return (
            <div key={caseKey} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm text-text">{caseKey}</span>
                <span className={`text-xs ${allPassed ? 'text-ok' : 'text-error'}`}>
                  {allPassed ? 'Passed' : 'Failed'}
                </span>
              </div>
              <div className="space-y-1.5">
                {results.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 border-t border-borderMuted pt-1.5 text-xs">
                    <span className="w-32 shrink-0 font-mono text-textMuted">{r.evaluatorType}</span>
                    <span
                      className={`w-16 shrink-0 ${
                        r.degraded ? 'text-warn' : r.passed ? 'text-ok' : 'text-error'
                      }`}
                    >
                      {r.degraded ? 'degraded' : r.passed ? 'pass' : 'fail'}
                    </span>
                    <span className="w-12 shrink-0 font-mono text-textFaint">
                      {r.score !== null ? r.score.toFixed(2) : '—'}
                    </span>
                    <span className="flex-1 text-textMuted">{r.reasoning ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  return (
    <RequireProject>
      <RunDetailContent runId={params.runId} />
    </RequireProject>
  );
}
