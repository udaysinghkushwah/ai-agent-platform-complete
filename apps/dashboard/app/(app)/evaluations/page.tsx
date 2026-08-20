'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/session';
import { evaluation, Dataset, ApiError } from '@/lib/api';
import { RequireProject } from '@/components/RequireProject';
import { formatTime } from '@/lib/format';

function EvaluationsContent() {
  const { projectId } = useSession();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  function refresh() {
    if (!projectId) return;
    setLoading(true);
    evaluation
      .listDatasets(projectId)
      .then(setDatasets)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load datasets'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [projectId]);

  async function handleCreate() {
    if (!projectId || name.trim().length < 2) return;
    setCreating(true);
    setError(null);
    try {
      await evaluation.createDataset(projectId, name, description || undefined);
      setName('');
      setDescription('');
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create dataset');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-semibold text-text">Evaluations</h1>
      <p className="mb-6 text-sm text-textMuted">
        Golden datasets and the runs scored against them. Score a batch of your agent's outputs to catch
        regressions before they ship.
      </p>

      <div className="mb-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text">New dataset</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dataset name, e.g. support-golden-set"
            className="min-w-[220px] flex-1 rounded border border-border bg-base px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="min-w-[220px] flex-1 rounded border border-border bg-base px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent"
          />
          <button
            onClick={handleCreate}
            disabled={creating || name.trim().length < 2}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-textMuted">Loading…</p>
      ) : datasets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-textMuted">No datasets yet. Create one above to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-textFaint">
                <th className="px-3 py-2 font-medium">Dataset</th>
                <th className="px-3 py-2 font-medium">Cases</th>
                <th className="px-3 py-2 font-medium">Runs</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="border-b border-borderMuted last:border-b-0 hover:bg-surface">
                  <td className="px-3 py-2.5">
                    <Link href={`/evaluations/${d.id}`} className="text-accent hover:underline">
                      {d.name}
                    </Link>
                    {d.description && <p className="mt-0.5 text-xs text-textFaint">{d.description}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-textMuted">{d.caseCount}</td>
                  <td className="px-3 py-2.5 text-textMuted">{d.runCount}</td>
                  <td className="px-3 py-2.5 text-xs text-textFaint">{formatTime(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function EvaluationsPage() {
  return (
    <RequireProject>
      <EvaluationsContent />
    </RequireProject>
  );
}
