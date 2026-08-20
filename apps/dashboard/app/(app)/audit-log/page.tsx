'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/lib/session';
import { audit, AuditEventItem, ApiError } from '@/lib/api';
import { formatTime } from '@/lib/format';

export default function AuditLogPage() {
  const { organizationId, ready } = useSession();
  const [items, setItems] = useState<AuditEventItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      if (!organizationId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await audit.list(organizationId, {
          resourceType: resourceType || undefined,
          cursor: reset ? undefined : (nextCursor ?? undefined),
        });
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setNextCursor(res.nextCursor);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.status === 403
              ? "You need Admin or Owner access to view this organization's audit log."
              : err.message
            : 'Failed to load audit log',
        );
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, resourceType],
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, resourceType]);

  if (!ready) return null;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-semibold text-text">Audit log</h1>
      <p className="mb-6 text-sm text-textMuted">
        Every sensitive action across this organization — access changes, key rotations, policy decisions.
        Admin/Owner only.
      </p>

      <input
        value={resourceType}
        onChange={(e) => setResourceType(e.target.value)}
        placeholder="Filter by resource type, e.g. api_key, tool, governance_policy"
        className="mb-4 w-full max-w-md rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent"
      />

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {loading && items.length === 0 ? (
        <p className="text-sm text-textMuted">Loading…</p>
      ) : items.length === 0 && !error ? (
        <p className="text-sm text-textFaint">No audit events match this filter.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-textFaint">
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Resource</th>
                <th className="px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-borderMuted last:border-b-0 hover:bg-surface">
                  <td className="px-3 py-2.5 font-mono text-xs text-text">{e.action}</td>
                  <td className="px-3 py-2.5 text-xs text-textMuted">
                    {e.actorType}:{e.actorId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-textMuted">
                    {e.resourceType}/{e.resourceId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-textFaint">{formatTime(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <button
          onClick={() => load(false)}
          className="mt-4 rounded border border-border px-3 py-1.5 text-sm text-textMuted hover:border-accent hover:text-text"
        >
          Load more
        </button>
      )}
    </div>
  );
}
