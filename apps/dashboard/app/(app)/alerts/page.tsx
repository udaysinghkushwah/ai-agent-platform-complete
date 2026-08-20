'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Clock, UserCheck, AlertTriangle, Bell, Sparkles, Plus, Play, Pause, Check, Shield } from 'lucide-react';
import { useSession } from '@/lib/session';
import { alerts, approvals, AlertRule, AlertEvent, PendingApprovalItem, ApiError } from '@/lib/api';
import { RequireProject } from '@/components/RequireProject';

const METRICS = ['ERROR_RATE', 'LATENCY_P95', 'COST', 'EVAL_SCORE', 'EVAL_REGRESSION', 'TOOL_FAILURE_RATE'];
const COMPARATORS = ['GT', 'GTE', 'LT', 'LTE'];

function EventStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: 'bg-red-500/10 text-red-400 border-red-500/30',
    ACKNOWLEDGED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 font-mono text-[10px] font-bold ${styles[status] ?? 'bg-white/10 text-white'}`}>
      {status}
    </span>
  );
}

function AlertsContent() {
  const { projectId } = useSession();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [metric, setMetric] = useState(METRICS[0]);
  const [comparator, setComparator] = useState(COMPARATORS[0]);
  const [threshold, setThreshold] = useState('0.1');
  const [notifyEmails, setNotifyEmails] = useState('');
  const [creating, setCreating] = useState(false);

  function refresh() {
    if (!projectId) return;
    alerts.listRules(projectId).then(setRules).catch(() => {});
    alerts.listEvents(projectId).then(setEvents).catch(() => {});
    approvals.list(projectId).then(setPendingApprovals).catch(() => {});
  }

  useEffect(refresh, [projectId]);

  async function handleResolveApproval(approvalId: string, action: 'APPROVE' | 'REJECT') {
    if (!projectId) return;
    try {
      await approvals.resolve(projectId, approvalId, action);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resolve approval request');
    }
  }

  async function handleCreateRule() {
    if (!projectId || name.trim().length < 2) return;
    setCreating(true);
    setError(null);
    try {
      await alerts.createRule(projectId, {
        name,
        metric,
        comparator,
        threshold: Number(threshold),
        notifyEmails: notifyEmails
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      });
      setName('');
      setNotifyEmails('');
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create rule');
    } finally {
      setCreating(false);
    }
  }

  async function togglePause(rule: AlertRule) {
    if (!projectId) return;
    await alerts.setRuleStatus(projectId, rule.id, rule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE');
    refresh();
  }

  async function acknowledge(event: AlertEvent) {
    if (!projectId) return;
    await alerts.setEventStatus(projectId, event.id, 'ACKNOWLEDGED');
    refresh();
  }

  const pendingCount = pendingApprovals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="gradient-brand flex h-10 w-10 items-center justify-center rounded-xl font-extrabold text-white shadow-lg glow-accent">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Alert Rules & <span className="gradient-text">Safety Guardrails</span>
            </h1>
          </div>
          <p className="text-xs text-textMuted max-w-2xl leading-relaxed">
            Manage Human-in-the-Loop (HITL) tool approval queues, configure metric alert triggers, and review real-time security events.
          </p>
        </div>

        {/* Quick Stats Bar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <UserCheck className="w-4 h-4 text-accent shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-bold text-textFaint block">HITL Pending</span>
              <span className="text-xs font-mono font-extrabold text-accent">
                {pendingCount} {pendingCount === 1 ? 'Request' : 'Requests'}
              </span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-bold text-textFaint block">Active Rules</span>
              <span className="text-xs font-mono font-extrabold text-white">{rules.filter((r) => r.status === 'ACTIVE').length} Configured</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 1. Human-in-the-Loop (HITL) Pending Approvals Section */}
      <div className="glass-panel p-7 rounded-2xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Human-in-the-Loop (HITL) Approvals Queue</h2>
              <p className="text-xs text-textMuted">High-risk tool execution requests intercepted by platform policy gates</p>
            </div>
          </div>

          <span className="text-[11px] font-mono font-bold text-accent bg-accent/10 border border-accent/20 px-3.5 py-1 rounded-full shadow-sm shrink-0">
            {pendingCount} Pending Approval{pendingCount === 1 ? '' : 's'}
          </span>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="py-12 text-center text-xs text-textFaint flex flex-col items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/40 mb-2" />
            No pending tool approval requests requiring human review.
          </div>
        ) : (
          /* Well-proportioned table column widths preventing button & status overlaps */
          <div className="rounded-xl border border-white/10 overflow-x-auto bg-black/20">
            <table className="w-full min-w-[720px] table-fixed text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-textMuted uppercase font-bold text-[10px] tracking-wider bg-black/40">
                  <th className="py-3.5 px-4 w-[18%]">Tool Name</th>
                  <th className="py-3.5 px-4 w-[10%]">Environment</th>
                  <th className="py-3.5 px-4 w-[28%]">Policy Reason / Context</th>
                  <th className="py-3.5 px-4 w-[14%]">Requested At</th>
                  <th className="py-3.5 px-4 w-[10%] text-center">Status</th>
                  <th className="py-3.5 px-4 text-right w-[20%]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {pendingApprovals.map((a) => (
                  <tr key={a.id} className="hover:bg-white/5 transition">
                    {/* Tool Name */}
                    <td className="py-4 px-4 font-mono font-bold text-white truncate" title={a.toolName}>
                      <span className="inline-flex items-center gap-2 truncate">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse" />
                        <span className="truncate">{a.toolName}</span>
                      </span>
                    </td>

                    {/* Environment */}
                    <td className="py-4 px-4">
                      <span className="font-mono uppercase text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {a.environment}
                      </span>
                    </td>

                    {/* Policy Reason / Context with hover tooltip */}
                    <td className="py-4 px-4">
                      <div className="truncate text-textMuted font-mono text-[11px]" title={a.reason ?? undefined}>
                        {a.reason}
                      </div>
                    </td>

                    {/* Requested At */}
                    <td className="py-4 px-4 font-mono text-textFaint text-[11px] truncate" title={new Date(a.requestedAt).toLocaleString()}>
                      {new Date(a.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                          a.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : a.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>

                    {/* Actions - 17% width guarantees zero overlap */}
                    <td className="py-4 px-4 text-right">
                      {a.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5 shrink-0">
                          <button
                            onClick={() => handleResolveApproval(a.id, 'APPROVE')}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition shadow-sm"
                            title="Approve Execution"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleResolveApproval(a.id, 'REJECT')}
                            className="px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-400 hover:bg-red-500/30 transition shadow-sm"
                            title="Reject Execution"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-textFaint">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Create Alert Rule Builder */}
      <div className="glass-panel p-7 rounded-2xl border border-white/10 space-y-5">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Create New Security & Metric Alert Rule</h2>
            <p className="text-xs text-textMuted">Automatically detect anomaly spikes, evaluation regressions, and tool failures</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-textMuted block mb-1">Rule Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High Error Velocity"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-white/10 text-xs font-medium text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-textMuted block mb-1">Target Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-white/10 text-xs font-medium text-white focus:outline-none focus:border-accent"
            >
              {METRICS.map((m) => (
                <option key={m} value={m} className="bg-surface text-white">
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-textMuted block mb-1">Comparator</label>
            <select
              value={comparator}
              onChange={(e) => setComparator(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-white/10 text-xs font-medium text-white focus:outline-none focus:border-accent"
            >
              {COMPARATORS.map((c) => (
                <option key={c} value={c} className="bg-surface text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-[11px] font-semibold text-textMuted block mb-1">Threshold Value</label>
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              type="number"
              step="any"
              placeholder="0.1"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div className="md:col-span-8">
            <label className="text-[11px] font-semibold text-textMuted block mb-1">Notification Recipient Emails (comma-separated)</label>
            <input
              value={notifyEmails}
              onChange={(e) => setNotifyEmails(e.target.value)}
              placeholder="dev@example.com, security@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div className="md:col-span-4 flex items-end">
            <button
              onClick={handleCreateRule}
              disabled={creating || !name.trim()}
              className="gradient-brand w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-xl glow-accent transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {creating ? 'Creating Rule…' : 'Create Alert Rule'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Configured Alert Rules Table */}
      <div className="glass-panel p-7 rounded-2xl border border-white/10 space-y-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-accent" /> Configured Alert Rules
        </h2>
        {rules.length === 0 ? (
          <div className="py-8 text-center text-xs text-textFaint">No alert rules configured yet.</div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
            <table className="w-full table-fixed text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-textMuted uppercase font-bold text-[10px] tracking-wider bg-black/40">
                  <th className="py-3.5 px-4 w-[35%]">Rule Name</th>
                  <th className="py-3.5 px-4 w-[35%]">Condition</th>
                  <th className="py-3.5 px-4 w-[15%]">Status</th>
                  <th className="py-3.5 px-4 text-right w-[15%]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5 transition">
                    <td className="py-3.5 px-4 font-bold text-white truncate" title={r.name}>{r.name}</td>
                    <td className="py-3.5 px-4 font-mono text-textMuted truncate">
                      <code className="text-accent">{r.metric}</code> {r.comparator} <code className="text-white font-bold">{r.threshold}</code>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => togglePause(r)}
                        className="text-xs font-bold text-accent hover:underline inline-flex items-center gap-1"
                      >
                        {r.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {r.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Triggered Alert Events Log */}
      <div className="glass-panel p-7 rounded-2xl border border-white/10 space-y-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" /> Triggered Alert Events Stream
        </h2>
        {events.length === 0 ? (
          <div className="py-8 text-center text-xs text-textFaint">No alert events triggered.</div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <div key={e.id} className="glass-card rounded-xl p-4 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white">{e.rule.name}</span>
                    <EventStatusBadge status={e.status} />
                  </div>
                  <p className="text-xs text-textMuted font-mono">{e.message}</p>
                </div>
                {e.status === 'OPEN' && (
                  <button
                    onClick={() => acknowledge(e)}
                    className="px-3.5 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-xs font-bold text-accent hover:bg-accent/30 transition shadow-sm"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <RequireProject>
      <AlertsContent />
    </RequireProject>
  );
}
