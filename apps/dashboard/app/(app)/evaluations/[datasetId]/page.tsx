'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/session';
import { evaluation, DatasetCase, EvaluationRunSummary, ApiError } from '@/lib/api';
import { RequireProject } from '@/components/RequireProject';
import { VerdictBadge, RunStatusBadge } from '@/components/EvaluationBadges';
import { formatPercent, formatTime } from '@/lib/format';

const EXAMPLE_CASES = `[
  {
    "caseKey": "refund-policy-01",
    "input": { "question": "Can I get a refund after 30 days?" },
    "expectedOutput": "No, refunds are only available within 30 days of purchase."
  }
]`;

const EXAMPLE_RUN = `{
  "evaluators": [
    { "type": "SEMANTIC_MATCH", "threshold": 0.4 }
  ],
  "outputs": [
    { "caseKey": "refund-policy-01", "output": "Refunds are only offered within 30 days of purchase." }
  ]
}`;

function DatasetDetailContent({ datasetId }: { datasetId: string }) {
  const router = useRouter();
  const { projectId } = useSession();
  const [cases, setCases] = useState<DatasetCase[]>([]);
  const [runs, setRuns] = useState<EvaluationRunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [casesJson, setCasesJson] = useState(EXAMPLE_CASES);
  const [runJson, setRunJson] = useState(EXAMPLE_RUN);
  const [runName, setRunName] = useState('');
  const [busy, setBusy] = useState(false);

  function refresh() {
    if (!projectId) return;
    evaluation.listCases(projectId, datasetId).then(setCases).catch(() => {});
    evaluation.listRuns(projectId, datasetId).then(setRuns).catch(() => {});
  }

  useEffect(refresh, [projectId, datasetId]);

  async function handleAddCases() {
    if (!projectId) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = JSON.parse(casesJson);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of cases');
      await evaluation.addCases(projectId, datasetId, parsed);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRun() {
    if (!projectId) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = JSON.parse(runJson);
      const run = await evaluation.createRun(projectId, datasetId, {
        name: runName || undefined,
        evaluators: parsed.evaluators,
        outputs: parsed.outputs,
      });
      router.push(`/evaluations/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8">
      <Link href="/evaluations" className="mb-4 inline-block text-xs text-textMuted hover:text-text">
        ← All datasets
      </Link>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-medium text-text">Cases ({cases.length})</h2>
          <p className="mb-3 text-xs text-textMuted">
            Paste a JSON array of cases. Re-adding the same <code>caseKey</code> updates it in place.
          </p>
          <textarea
            value={casesJson}
            onChange={(e) => setCasesJson(e.target.value)}
            rows={8}
            className="w-full rounded border border-border bg-base p-2 font-mono text-xs text-text outline-none focus:border-accent"
          />
          <button
            onClick={handleAddCases}
            disabled={busy}
            className="mt-2 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            Add / update cases
          </button>

          {cases.length > 0 && (
            <div className="mt-4 max-h-64 overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b border-borderMuted last:border-b-0">
                      <td className="px-2 py-1.5 font-mono text-textMuted">{c.caseKey}</td>
                      <td className="px-2 py-1.5 text-textFaint">{c.tags.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-medium text-text">New run</h2>
          <p className="mb-3 text-xs text-textMuted">
            Submit outputs your agent already produced (run your own harness, paste results here) along with
            which evaluators to score them with.
          </p>
          <input
            value={runName}
            onChange={(e) => setRunName(e.target.value)}
            placeholder="Run name (optional)"
            className="mb-2 w-full rounded border border-border bg-base px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent"
          />
          <textarea
            value={runJson}
            onChange={(e) => setRunJson(e.target.value)}
            rows={8}
            className="w-full rounded border border-border bg-base p-2 font-mono text-xs text-text outline-none focus:border-accent"
          />
          <button
            onClick={handleCreateRun}
            disabled={busy}
            className="mt-2 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            Run evaluation
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-medium text-text">Run history</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-textFaint">No runs yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-textFaint">
                <th className="px-3 py-2 font-medium">Run</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
                <th className="px-3 py-2 font-medium">Pass rate</th>
                <th className="px-3 py-2 font-medium">Cases</th>
                <th className="px-3 py-2 font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-borderMuted last:border-b-0 hover:bg-surface">
                  <td className="px-3 py-2.5">
                    <Link href={`/evaluations/runs/${r.id}`} className="text-accent hover:underline">
                      {r.name ?? r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <RunStatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <VerdictBadge verdict={r.verdict} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-textMuted">
                    {r.passRate !== null ? formatPercent(r.passRate) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-textMuted">
                    {r.completedCases}/{r.totalCases}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-textFaint">{formatTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DatasetDetailPage() {
  const params = useParams<{ datasetId: string }>();
  return (
    <RequireProject>
      <DatasetDetailContent datasetId={params.datasetId} />
    </RequireProject>
  );
}
