'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/lib/session';
import { analytics, TraceDetail, SpanDetail, ApiError } from '@/lib/api';
import { RequireProject } from '@/components/RequireProject';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCost, formatMs, formatTime, formatTokens } from '@/lib/format';

interface SpanNode extends SpanDetail {
  children: SpanNode[];
}

function buildTree(spans: SpanDetail[]): SpanNode[] {
  const nodes = new Map<string, SpanNode>(spans.map((s) => [s.spanId, { ...s, children: [] }]));
  const roots: SpanNode[] = [];

  for (const node of nodes.values()) {
    if (node.parentSpanId && nodes.has(node.parentSpanId)) {
      nodes.get(node.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function SpanRow({ node, depth, traceStart, traceDurationMs, onSelect }: {
  node: SpanNode;
  depth: number;
  traceStart: number;
  traceDurationMs: number;
  onSelect: (span: SpanDetail) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const offsetMs = new Date(node.startedAt).getTime() - traceStart;
  const leftPct = traceDurationMs > 0 ? Math.max(0, (offsetMs / traceDurationMs) * 100) : 0;
  const widthPct = traceDurationMs > 0 && node.durationMs ? Math.min(100 - leftPct, (node.durationMs / traceDurationMs) * 100) : 2;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(node)}
        className="flex w-full items-center gap-3 border-b border-borderMuted px-3 py-2 text-left hover:bg-surface"
      >
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
          {node.children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="text-textFaint hover:text-text"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? '▾' : '▸'}
            </button>
          )}
          <span className="w-52 truncate font-mono text-xs text-text">{node.name ?? node.eventType}</span>
        </div>
        <span className="w-16 shrink-0 font-mono text-xs text-textFaint">{node.eventType}</span>
        <div className="relative h-2 flex-1 rounded bg-borderMuted">
          <div
            className={`absolute h-2 rounded ${node.status === 'error' ? 'bg-error' : 'bg-accent'}`}
            style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 1)}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right font-mono text-xs text-textMuted">{formatMs(node.durationMs)}</span>
        <span className="w-20 shrink-0 text-right font-mono text-xs text-textMuted">{formatCost(node.cost ?? 0)}</span>
        <StatusBadge status={node.status} />
      </div>
      {expanded &&
        node.children.map((child) => (
          <SpanRow
            key={child.id}
            node={child}
            depth={depth + 1}
            traceStart={traceStart}
            traceDurationMs={traceDurationMs}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function TraceDetailContent({ traceId }: { traceId: string }) {
  const { projectId } = useSession();
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<SpanDetail | null>(null);

  useEffect(() => {
    if (!projectId) return;
    analytics
      .traceDetail(projectId, traceId)
      .then(setTrace)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load trace'));
  }, [projectId, traceId]);

  if (error) return <p className="p-8 text-sm text-error">{error}</p>;
  if (!trace) return <p className="p-8 text-sm text-textMuted">Loading…</p>;

  const tree = buildTree(trace.spans);
  const traceStart = new Date(trace.startedAt).getTime();
  const traceDurationMs = trace.endedAt ? new Date(trace.endedAt).getTime() - traceStart : 0;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-6">
          <p className="mb-1 font-mono text-xs text-textFaint">{trace.traceId}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold text-text">{trace.agentId ?? 'Unnamed agent'}</h1>
            <StatusBadge status={trace.status} />
            {trace.agentVersion && (
              <span className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-textMuted">
                {trace.agentVersion}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-textFaint">
            Started {formatTime(trace.startedAt)} · {trace.spanCount} spans · {formatCost(trace.totalCost)} ·{' '}
            {formatTokens(trace.totalInputTokens)} in / {formatTokens(trace.totalOutputTokens)} out
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide text-textFaint">
            <span className="w-52 pl-[14px]">Span</span>
            <span className="w-16">Type</span>
            <span className="flex-1">Timeline</span>
            <span className="w-16 text-right">Duration</span>
            <span className="w-20 text-right">Cost</span>
            <span className="w-16 text-right">Status</span>
          </div>
          {tree.map((node) => (
            <SpanRow
              key={node.id}
              node={node}
              depth={0}
              traceStart={traceStart}
              traceDurationMs={traceDurationMs}
              onSelect={setSelectedSpan}
            />
          ))}
        </div>
      </div>

      {selectedSpan && (
        <div className="w-96 shrink-0 overflow-y-auto border-l border-border bg-surface p-5">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="font-mono text-sm text-text">{selectedSpan.name ?? selectedSpan.eventType}</h2>
            <button onClick={() => setSelectedSpan(null)} className="text-textFaint hover:text-text">
              ✕
            </button>
          </div>
          <dl className="space-y-3 text-sm">
            <Field label="Status"><StatusBadge status={selectedSpan.status} /></Field>
            {selectedSpan.errorMessage && (
              <Field label="Error">
                <span className="text-error">{selectedSpan.errorMessage}</span>
              </Field>
            )}
            <Field label="Provider / model">
              <span className="font-mono text-xs text-text">
                {selectedSpan.provider ?? '—'} / {selectedSpan.model ?? '—'}
              </span>
            </Field>
            <Field label="Duration"><span className="font-mono text-xs text-text">{formatMs(selectedSpan.durationMs)}</span></Field>
            <Field label="Tokens">
              <span className="font-mono text-xs text-text">
                {formatTokens(selectedSpan.inputTokens)} in / {formatTokens(selectedSpan.outputTokens)} out
              </span>
            </Field>
            <Field label="Cost"><span className="font-mono text-xs text-text">{formatCost(selectedSpan.cost ?? 0)}</span></Field>
            <Field label="Started"><span className="text-xs text-textMuted">{formatTime(selectedSpan.startedAt)}</span></Field>
            {selectedSpan.metadata && Object.keys(selectedSpan.metadata).length > 0 && (
              <Field label="Metadata">
                <pre className="mt-1 overflow-x-auto rounded bg-base p-2 font-mono text-xs text-textMuted">
                  {JSON.stringify(selectedSpan.metadata, null, 2)}
                </pre>
              </Field>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

export default function TraceDetailPage() {
  const params = useParams<{ traceId: string }>();
  return (
    <RequireProject>
      <TraceDetailContent traceId={params.traceId} />
    </RequireProject>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs uppercase tracking-wide text-textFaint">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
