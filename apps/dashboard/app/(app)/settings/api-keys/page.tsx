'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { apiKeys, ApiKeySummary, CreatedApiKey, ApiError } from '@/lib/api';
import { RequireProject } from '@/components/RequireProject';
import { formatTime } from '@/lib/format';

function ApiKeysContent() {
  const { projectId } = useSession();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [justCreated, setJustCreated] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    if (!projectId) return;
    setLoading(true);
    apiKeys
      .list(projectId)
      .then(setKeys)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load keys'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [projectId]);

  async function handleCreate() {
    if (!projectId) return;
    setError(null);
    try {
      const created = await apiKeys.create(projectId, newKeyName || undefined);
      setJustCreated(created);
      setNewKeyName('');
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create key');
    }
  }

  async function handleRevoke(keyId: string) {
    if (!projectId) return;
    if (!confirm('Revoke this key? Anything using it will stop being able to send data immediately.')) return;
    await apiKeys.revoke(projectId, keyId);
    refresh();
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-semibold text-text">API keys</h1>
      <p className="mb-6 text-sm text-textMuted">
        Keys authenticate the SDK to send telemetry for this project. Only Owners and Admins can manage them.
      </p>

      {justCreated && (
        <div className="mb-6 rounded-lg border border-accent/40 bg-accentMuted/20 p-4">
          <p className="mb-2 text-sm font-medium text-text">Copy this key now — it won't be shown again.</p>
          <code className="block break-all rounded bg-base px-3 py-2 font-mono text-sm text-accent">
            {justCreated.key}
          </code>
          <button
            onClick={() => setJustCreated(null)}
            className="mt-3 text-xs text-textMuted underline decoration-border underline-offset-2 hover:text-text"
          >
            I've copied it
          </button>
        </div>
      )}

      <div className="mb-6 flex gap-2">
        <input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g. production-worker)"
          className="flex-1 max-w-xs rounded border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent"
        />
        <button
          onClick={handleCreate}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Create key
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-textMuted">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-textFaint">No keys yet for this project.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-textFaint">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Prefix</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-borderMuted last:border-b-0">
                  <td className="px-3 py-2.5 text-text">{k.name}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-textMuted">{k.keyPrefix}…</td>
                  <td className="px-3 py-2.5 text-xs text-textFaint">{formatTime(k.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    {k.revokedAt ? (
                      <span className="text-xs text-textFaint">Revoked</span>
                    ) : (
                      <span className="text-xs text-ok">Active</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!k.revokedAt && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-xs text-error underline decoration-error/30 underline-offset-2 hover:decoration-error"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <RequireProject>
      <ApiKeysContent />
    </RequireProject>
  );
}
