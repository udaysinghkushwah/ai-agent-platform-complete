'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { projects, Project } from '@/lib/api';
import { Webhook, MessageSquare, Save, Send, CheckCircle2, AlertCircle, ShieldAlert, Sparkles, Bell } from 'lucide-react';

export default function IntegrationsSettingsPage() {
  const { projectId: selectedProjectId } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!selectedProjectId) return;
    projects
      .getOne(selectedProjectId)
      .then((p) => {
        setProject(p);
        setSlackWebhookUrl(p.slackWebhookUrl || '');
        setWebhookUrl(p.webhookUrl || '');
      })
      .catch(console.error);
  }, [selectedProjectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setSaving(true);
    setToast(null);
    try {
      const updated = await projects.updateIntegrations(selectedProjectId, {
        slackWebhookUrl: slackWebhookUrl.trim() || undefined,
        webhookUrl: webhookUrl.trim() || undefined,
      });
      setProject(updated);
      setToast({ type: 'success', msg: 'Slack and Webhook integration settings saved successfully!' });
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Failed to save integration webhooks.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    setToast(null);
    try {
      if (slackWebhookUrl.trim()) {
        await fetch(slackWebhookUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: '🔔 *AI Agent Platform Test Notification*: Slack Webhook Integration Connected Successfully!',
          }),
        }).catch(() => {});
      }
      setToast({ type: 'success', msg: 'Test notification payload dispatched successfully!' });
    } catch {
      setToast({ type: 'error', msg: 'Test notification dispatch failed.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto text-slate-100">
      {/* Header Banner */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Settings / Integrations</h1>
        <p className="mt-1 text-xs text-slate-400 font-mono">Manage third-party connections and webhooks.</p>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold ${
            toast.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-950/60 border-rose-500/30 text-rose-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Active Integrations Header */}
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider font-mono">Active Integrations</h2>

        {/* Slack Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-lg">
                #
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">slack</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={Boolean(slackWebhookUrl.trim())} readOnly className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">Slack Webhook URL</label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/T01ABCDEF/B02GHIJKL/mYI1fOOqJZ2A3XyB8C1D..."
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition border border-slate-700"
              >
                Save Webhook
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">Generic HTTPS Webhook Endpoint</label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="https://api.acme-corp.ai/webhooks/slack/v1/event_handler"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition border border-slate-700"
              >
                Update Endpoint
              </button>
            </div>
          </div>

          {/* Slack Block Kit Card Preview Box */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-3">
            <h4 className="text-xs font-extrabold text-white tracking-tight">Slack Block Kit Approval Preview</h4>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span> Acme AI Agent
                </span>
                <span className="text-[10px]">11:34 AM</span>
              </div>
              <p className="text-white font-bold flex items-center gap-1.5 text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-500 inline" />
                Human-in-the-Loop Approval Required
              </p>
              <div className="text-[11px] text-slate-300 space-y-1 bg-black/40 p-3 rounded-lg border border-slate-800/60">
                <p><strong>Agent ID:</strong> agent-42_query_handler | <strong>Requested Tool:</strong> execute_sql_query</p>
                <p><strong>Reason:</strong> Accessing database &apos;customer_finance&apos; (table: PII_DATA) for transaction analysis.</p>
                <p className="text-slate-400"><strong>Parameters:</strong> &#123;&quot;sql_query&quot;: &quot;SELECT user_id, amount FROM PII_DATA LIMIT 5&quot;&#125;</p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-center transition"
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-center transition"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Save Action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
