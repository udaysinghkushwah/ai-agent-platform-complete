'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/session';
import { analytics, TraceListItem, ApiError } from '@/lib/api';
import { RequireProject } from '@/components/RequireProject';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCost, formatRelativeTime, formatTokens } from '@/lib/format';

function TracesContent() {
  const { projectId } = useSession();
  const [items, setItems] = useState<TraceListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState('');
  const [agentId, setAgentId] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (opts: { reset: boolean }) => {
      if (!projectId) return;
      opts.reset ? setLoading(true) : setLoadingMore(true);
      setError(null);
      try {
        const res = await analytics.listTraces(projectId, {
          status: status || undefined,
          agentId: agentId || undefined,
          search: search || undefined,
          cursor: opts.reset ? undefined : (nextCursor ?? undefined),
        });
        setItems((prev) => (opts.reset ? res.items : [...prev, ...res.items]));
        setNextCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load traces');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId, status, agentId, search, nextCursor],
  );

  useEffect(() => {
    load({ reset: true });
  }, [projectId, status, agentId, search]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Execution Traces</h1>
          <p className="mt-1 text-xs text-textMuted">
            Comprehensive stream of agent interactions, LLM prompts, tool executions, and latency breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-textMuted font-mono">Total Traces: {items.length}</span>
        </div>
      </div>

      {/* Glassmorphic Search & Filters Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[240px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search trace ID or session ID..."
            className="w-full rounded-lg border border-white/10 bg-surface/90 px-3.5 py-2 text-xs font-mono text-white placeholder:text-textFaint outline-none focus:border-accent"
          />
        </div>

        <div className="w-48">
          <input
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="Filter agent ID..."
            className="w-full rounded-lg border border-white/10 bg-surface/90 px-3.5 py-2 text-xs font-mono text-white placeholder:text-textFaint outline-none focus:border-accent"
          />
        </div>

        <div className="w-36">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface/90 px-3.5 py-2 text-xs font-medium text-white outline-none focus:border-accent"
          >
            <option value="">All Statuses</option>
            <option value="ok">OK Only</option>
            <option value="error">Error Only</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-xs text-error font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
            <p className="text-xs text-textMuted">Loading trace stream...</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-dashed border-white/20">
          <p className="text-sm font-semibold text-white">No traces match these search criteria</p>
          <p className="mt-1 text-xs text-textMuted">Try clearing filters or running a test agent call.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-textMuted uppercase font-bold text-[10px] tracking-wider">
                <th className="px-4 py-3">Trace ID</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Spans</th>
                <th className="px-4 py-3 text-right">Tokens (In / Out)</th>
                <th className="px-4 py-3 text-right">Est. Cost</th>
                <th className="px-4 py-3 text-right">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-white/5 transition duration-150">
                  <td className="px-4 py-3 font-mono">
                    <Link
                      href={`/traces/${t.id}`}
                      className="text-accent font-semibold hover:underline flex items-center gap-1.5"
                    >
                      <span className="text-[10px]">⚡</span>
                      <span>{t.traceId}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-white/90">{t.agentId ?? 'default'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white font-medium">{t.spanCount}</td>
                  <td className="px-4 py-3 text-right font-mono text-textMuted">
                    {formatTokens(t.totalInputTokens)} / {formatTokens(t.totalOutputTokens)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                    {formatCost(t.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-right text-textMuted font-mono text-[11px]">
                    {formatRelativeTime(t.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => load({ reset: false })}
            disabled={loadingMore}
            className="glass-card rounded-xl px-5 py-2.5 text-xs font-bold text-white hover:border-accent hover:text-accent transition disabled:opacity-50"
          >
            {loadingMore ? 'Loading More Traces…' : 'Load More Traces'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TracesPage() {
  return (
    <RequireProject>
      <TracesContent />
    </RequireProject>
  );
}
