'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Cpu, Wrench, AlertTriangle, CheckCircle2, Clock, Coins, Layers, Copy, Check } from 'lucide-react';
import { analytics, TraceDetail, ApiError } from '@/lib/api';
import { formatCost, formatMs, formatTokens } from '@/lib/format';
import { StatusBadge } from './StatusBadge';

export function TraceDrawer({
  traceId,
  projectId,
  onClose,
}: {
  traceId: string | null;
  projectId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!traceId || !projectId) return;
    setLoading(true);
    setError(null);
    analytics
      .traceDetail(projectId, traceId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load trace details'))
      .finally(() => setLoading(false));
  }, [traceId, projectId]);

  function copyTraceId() {
    if (detail?.traceId) {
      navigator.clipboard.writeText(detail.traceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <AnimatePresence>
      {traceId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          {/* Backdrop dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-white/10 glass-panel shadow-2xl bg-surface/95"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 bg-black/30">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white font-mono">{traceId.slice(0, 16)}…</h2>
                    <button
                      onClick={copyTraceId}
                      className="text-textMuted hover:text-white p-1 transition"
                      title="Copy full trace ID"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-textMuted">Trace Details & Execution Waterfall</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-textMuted hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
                    <p className="text-xs text-textMuted">Loading trace waterfall...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-xs text-error font-semibold">
                  {error}
                </div>
              ) : detail ? (
                <>
                  {/* Top Stats Overview Pill Row */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="glass-card p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-textMuted font-bold block mb-1">Status</span>
                      <StatusBadge status={detail.status} />
                    </div>
                    <div className="glass-card p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-textMuted font-bold block mb-1">Spans</span>
                      <span className="font-mono text-sm font-bold text-white">{detail.spanCount}</span>
                    </div>
                    <div className="glass-card p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-textMuted font-bold block mb-1">Cost</span>
                      <span className="font-mono text-sm font-bold text-accent">{formatCost(detail.totalCost)}</span>
                    </div>
                    <div className="glass-card p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-textMuted font-bold block mb-1">Tokens</span>
                      <span className="font-mono text-xs font-semibold text-white">
                        {formatTokens(detail.totalInputTokens)} / {formatTokens(detail.totalOutputTokens)}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Bar */}
                  <div className="glass-card p-4 rounded-xl border border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-textMuted font-medium">Agent ID:</span>
                      <span className="font-mono text-white font-semibold">{detail.agentId || 'default-agent'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-textMuted font-medium">Environment:</span>
                      <span className="font-mono text-ok uppercase text-[10px] font-bold bg-ok/10 px-2 py-0.5 rounded border border-ok/20">
                        {detail.environment || 'production'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-textMuted font-medium">Started At:</span>
                      <span className="font-mono text-textMuted">{new Date(detail.startedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Waterfall Spans Timeline */}
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-accent" />
                      Span Execution Timeline
                    </h3>

                    <div className="space-y-3">
                      {detail.spans.map((span, idx) => {
                        const isLlm = span.eventType === 'llm';
                        const isTool = span.eventType === 'tool';
                        const isError = span.status === 'error';

                        return (
                          <div
                            key={span.id}
                            className={`glass-card p-4 rounded-xl border transition ${
                              isError ? 'border-error/30 bg-error/5' : 'border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                                  isLlm ? 'bg-purple-500/20 text-purple-400' : isTool ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  {isLlm ? <Cpu className="h-3.5 w-3.5" /> : isTool ? <Wrench className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                                </span>
                                <span className="font-mono text-xs font-bold text-white">{span.name || span.eventType}</span>
                                <span className="text-[10px] font-mono text-textFaint uppercase bg-white/5 px-2 py-0.5 rounded">
                                  {span.eventType}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs font-mono">
                                {span.model && <span className="text-purple-400 font-semibold">{span.model}</span>}
                                {span.durationMs && <span className="text-textMuted">{formatMs(span.durationMs)}</span>}
                                {span.cost && <span className="text-accent font-semibold">{formatCost(span.cost)}</span>}
                              </div>
                            </div>

                            {span.errorMessage && (
                              <div className="mt-2 rounded-lg bg-error/10 border border-error/20 p-2.5 text-xs text-error font-mono flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{span.errorMessage}</span>
                              </div>
                            )}

                            {span.metadata && Object.keys(span.metadata).length > 0 && (
                              <div className="mt-3">
                                <span className="text-[10px] uppercase font-bold text-textFaint block mb-1">Payload Metadata</span>
                                <pre className="overflow-x-auto rounded-lg bg-black/50 p-2.5 font-mono text-[11px] text-textMuted border border-white/5">
                                  {JSON.stringify(span.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
