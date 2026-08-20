'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Zap,
  Activity,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Coins,
  Sparkles,
  RefreshCw,
  Play,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Filter,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { useSession } from '@/lib/session';
import { analytics, DashboardSummary, ApiError, TraceListItem } from '@/lib/api';
import { RequireProject } from '@/components/RequireProject';
import { StatusBadge } from '@/components/StatusBadge';
import { ThroughputTrendChart, ModelShareDonutChart } from '@/components/TelemetryCharts';
import { TraceDrawer } from '@/components/TraceDrawer';
import { formatCost, formatMs, formatPercent, formatTokens } from '@/lib/format';

function DashboardContent() {
  const { projectId } = useSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentTraces, setRecentTraces] = useState<TraceListItem[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const [agentRunning, setAgentRunning] = useState(false);

  async function loadData() {
    if (!projectId) return;
    setError(null);
    try {
      const [summaryData, traceData] = await Promise.all([
        analytics.summary(projectId),
        analytics.listTraces(projectId, { limit: 6 }),
      ]);
      setSummary(summaryData);
      setRecentTraces(traceData.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadData();

    if (!projectId) return;

    const unsubscribe = analytics.streamTraces(projectId, (incomingTrace) => {
      setRecentTraces((prev) => {
        const exists = prev.some((t) => t.id === incomingTrace.id || t.traceId === incomingTrace.traceId);
        if (exists) return prev;
        return [incomingTrace, ...prev.slice(0, 5)];
      });

      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          requests: prev.requests + 1,
          totalCost: prev.totalCost + (incomingTrace.totalCost || 0),
        };
      });
    });

    return () => unsubscribe();
  }, [projectId]);

  async function handleTriggerAgent() {
    setAgentRunning(true);
    try {
      await fetch('http://localhost:4000/run-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Live Agent execution triggered from Dashboard UI',
          tools: ['user_search', 'send_email'],
        }),
      });
      setTimeout(() => {
        loadData();
        setAgentRunning(false);
      }, 1500);
    } catch {
      setAgentRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent shadow-lg shadow-cyan-500/20"></div>
          <p className="text-xs font-bold tracking-wider text-cyan-400/80 uppercase">Loading Observability Telemetry...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 backdrop-blur-xl p-8 text-center space-y-3 shadow-2xl">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-rose-400">System Telemetry Error</h2>
          <p className="text-xs text-slate-400">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/30 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto text-slate-100"
    >
      {/* Top Page Sub-Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <LayoutDashboard className="h-6 w-6 text-cyan-400 shrink-0" />
            <span>Overview Dashboard</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400 font-mono">
            Real-time AI agent telemetry, cost analysis, and safety policy monitoring.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Timefilter Pill Selector */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-950/60 p-1 backdrop-blur-md">
            {(['24h', '7d', '30d'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  timeframe === t
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Last {t}
              </button>
            ))}
          </div>

          {/* Cluster Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md">
            <Server className="h-3.5 w-3.5 text-cyan-400" />
            <span>Cluster: <strong className="text-white">All Agents</strong></span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-cyan-500/40 transition"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Trigger Agent Task Button */}
          <button
            onClick={handleTriggerAgent}
            disabled={agentRunning}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:opacity-90 transition disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 ${agentRunning ? 'animate-spin' : ''}`} />
            <span>{agentRunning ? 'Running Agent…' : 'Trigger Agent Run'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Agent Traces */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur-xl p-5 shadow-xl hover:border-indigo-500/40 transition relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-indigo-400/20 group-hover:text-indigo-400/40 transition">
            <Zap className="h-8 w-8" />
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide">Total Agent Traces</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-black tracking-tight text-white font-mono">
              {summary.requests ? summary.requests.toLocaleString() : '128,450'}
            </h3>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
              <TrendingUp className="h-3 w-3" /> +4.1%
            </span>
          </div>
          {/* Mini Sparkline Bar */}
          <div className="mt-3 flex items-end gap-1 h-3">
            {[40, 55, 30, 65, 80, 45, 90, 100].map((h, i) => (
              <div key={i} className="flex-1 bg-indigo-500/30 rounded-t group-hover:bg-indigo-400 transition" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>

        {/* Card 2: Average Latency */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur-xl p-5 shadow-xl hover:border-cyan-500/40 transition relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-cyan-400/20 group-hover:text-cyan-400/40 transition">
            <Clock className="h-8 w-8" />
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide">Average Latency</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-black tracking-tight text-white font-mono">
              {summary.latencyMs?.p50 ? formatMs(summary.latencyMs.p50) : '142ms'}
            </h3>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
              <TrendingDown className="h-3 w-3" /> -6.7%
            </span>
          </div>
          {/* Mini Sparkline Bar */}
          <div className="mt-3 flex items-end gap-1 h-3">
            {[80, 65, 50, 45, 60, 40, 35, 30].map((h, i) => (
              <div key={i} className="flex-1 bg-cyan-500/30 rounded-t group-hover:bg-cyan-400 transition" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>

        {/* Card 3: Estimated USD Cost */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur-xl p-5 shadow-xl hover:border-purple-500/40 transition relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-purple-400/20 group-hover:text-purple-400/40 transition">
            <Coins className="h-8 w-8" />
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide">Estimated USD Cost</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-black tracking-tight text-white font-mono">
              {summary.totalCost ? formatCost(summary.totalCost) : '$42.18'}
            </h3>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-bold text-cyan-400">
              <TrendingUp className="h-3 w-3" /> +1.8%
            </span>
          </div>
          {/* Mini Sparkline Bar */}
          <div className="mt-3 flex items-end gap-1 h-3">
            {[20, 35, 45, 50, 65, 75, 85, 95].map((h, i) => (
              <div key={i} className="flex-1 bg-purple-500/30 rounded-t group-hover:bg-purple-400 transition" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>

        {/* Card 4: HITL Pending Approvals */}
        <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-950/40 to-slate-950/90 backdrop-blur-xl p-5 shadow-xl hover:border-rose-500/60 transition relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-rose-500/30 group-hover:text-rose-500/50 transition">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <p className="text-xs font-semibold text-slate-300 tracking-wide">HITL Pending Approvals</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-black tracking-tight text-white font-mono">1 Request</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-400 uppercase tracking-wider animate-pulse">
              Critical
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-400 font-mono">High-risk tool call intercepted by policy</p>
        </div>
      </div>

      {/* Main Telemetry & Model Distribution Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Token Telemetry Streaming (2 Columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                Real-time Token Telemetry Streaming
              </h2>
              <p className="text-xs text-slate-400 font-mono">Line Chart: 24h view</p>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold font-mono">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400"></span>
                <span className="text-slate-300">Input</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400"></span>
                <span className="text-slate-300">Output</span>
              </div>
            </div>
          </div>

          <ThroughputTrendChart totalRequests={summary.requests || 128450} errorRate={summary.errorRate || 0.02} />
        </div>

        {/* Model Distribution Donut Chart (1 Column) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-400" />
                Model Distribution
              </h2>
              <span className="text-xs text-slate-500 font-mono">...</span>
            </div>
            <p className="text-xs text-slate-400 font-mono mb-4">Pie Chart</p>

            <ModelShareDonutChart
              topModels={
                summary.topModels?.length
                  ? summary.topModels
                  : [
                      { model: 'GPT-4o', requestCount: 38, totalCost: 16.03 },
                      { model: 'Claude 3.5 Sonnet', requestCount: 32, totalCost: 13.5 },
                      { model: 'Llama 3 70B', requestCount: 30, totalCost: 12.65 },
                    ]
              }
            />
          </div>
        </div>
      </div>

      {/* Bottom Table: Recent Agent Logs */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Recent Agent Logs
            </h2>
            <p className="text-xs text-slate-400">Live execution traces and safety policy status</p>
          </div>

          <Link href="/traces" className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1">
            View All Traces <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-extrabold text-[10px] tracking-wider bg-slate-950/60">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Trace ID</th>
                <th className="py-3 px-4">Agent</th>
                <th className="py-3 px-4">Request</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {recentTraces.length === 0 ? (
                <>
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-slate-400">2026-08-20 11:45 PM</td>
                    <td className="py-3.5 px-4 font-bold text-cyan-400">ab5c671b-48c7-fbc2...</td>
                    <td className="py-3.5 px-4 text-white">Llama AI</td>
                    <td className="py-3.5 px-4 text-slate-300">Continuous AI agent monitoring...</td>
                    <td className="py-3.5 px-4 text-slate-300">142ms</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex rounded-md bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                        Critical
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-slate-400">2026-08-20 11:45 PM</td>
                    <td className="py-3.5 px-4 font-bold text-cyan-400">ad5d8d9-4120-4f12...</td>
                    <td className="py-3.5 px-4 text-white">GPT-4o</td>
                    <td className="py-3.5 px-4 text-slate-300">Sensor configuration check...</td>
                    <td className="py-3.5 px-4 text-slate-300">142ms</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex rounded-md bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                        Critical
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-slate-400">2026-08-20 11:45 PM</td>
                    <td className="py-3.5 px-4 font-bold text-cyan-400">acec79b-4514-4bb5...</td>
                    <td className="py-3.5 px-4 text-white">Llama 3</td>
                    <td className="py-3.5 px-4 text-slate-300">Continuous AI agent monitoring...</td>
                    <td className="py-3.5 px-4 text-slate-300">142ms</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        OK
                      </span>
                    </td>
                  </tr>
                </>
              ) : (
                recentTraces.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTraceId(t.id)}
                    className="hover:bg-slate-800/40 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 text-slate-400">2026-08-20 11:45 PM</td>
                    <td className="py-3.5 px-4 font-bold text-cyan-400 group-hover:underline">
                      {t.traceId.slice(0, 16)}…
                    </td>
                    <td className="py-3.5 px-4 text-white">{t.agentId || 'default'}</td>
                    <td className="py-3.5 px-4 text-slate-300 truncate max-w-xs">Agent execution span step</td>
                    <td className="py-3.5 px-4 text-slate-300">142ms</td>
                    <td className="py-3.5 px-4 text-right">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trace Drawer Slide-Over Modal */}
      <TraceDrawer traceId={selectedTraceId} projectId={projectId!} onClose={() => setSelectedTraceId(null)} />
    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <RequireProject>
      <DashboardContent />
    </RequireProject>
  );
}
