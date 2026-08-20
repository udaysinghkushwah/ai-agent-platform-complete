'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { auth, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

const DEMO_SPANS = [
  { name: 'agent.run', depth: 0, width: 100, status: 'ok' as const, ms: 1840 },
  { name: 'llm.chat.completion', depth: 1, width: 58, status: 'ok' as const, ms: 620 },
  { name: 'tool.search_docs', depth: 1, width: 22, status: 'ok' as const, ms: 210 },
  { name: 'retrieval.vector_query', depth: 2, width: 14, status: 'ok' as const, ms: 95 },
  { name: 'governance.policy_check', depth: 1, width: 12, status: 'ok' as const, ms: 45 },
  { name: 'llm.chat.completion', depth: 1, width: 40, status: 'ok' as const, ms: 410 },
];

function TraceWaterfall() {
  return (
    <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl">
      <div className="mb-4 flex items-center justify-between font-mono text-xs text-textMuted border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ok animate-ping"></span>
          <span className="font-semibold text-white">trace_8f21ac90</span>
        </div>
        <span className="font-bold text-accent">1.84s total</span>
      </div>
      <div className="space-y-2.5">
        {DEMO_SPANS.map((span, i) => (
          <div key={i} className="flex items-center gap-3" style={{ paddingLeft: span.depth * 14 }}>
            <span className="w-40 shrink-0 truncate font-mono text-xs font-medium text-textMuted">{span.name}</span>
            <div className="h-2.5 flex-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full ${(span.status as string) === 'error' ? 'bg-error' : 'gradient-brand'} ${
                  i === 0 ? 'animate-pulse' : ''
                }`}
                style={{ width: `${span.width}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-textFaint">{span.ms}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('dev@example.com');
  const [password, setPassword] = useState('devpassword123');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = mode === 'login' ? await auth.login(email, password) : await auth.register(email, password, name);
      setSession(res.accessToken, res.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left Hero Side */}
      <div className="hidden flex-col justify-center border-r border-white/10 glass-panel px-16 lg:flex relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-accent/10 blur-3xl"></div>
        <div className="relative z-10">
          <div className="gradient-brand flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-white shadow-xl glow-accent mb-6 text-xl">
            AI
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            AI Agent Reliability & Governance Platform
          </h2>
          <p className="mb-8 font-mono text-xs uppercase tracking-widest text-accent font-semibold">
            Every run, accounted for
          </p>
          <TraceWaterfall />
          <p className="mt-8 max-w-md text-xs text-textMuted leading-relaxed">
            Trace every call your agents make, catch regressions before they ship, enforce real-time governance policy gates, and know exactly what a production agent run cost — in dollars and tokens.
          </p>
        </div>
      </div>

      {/* Right Login Form Side */}
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl">
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="mb-6 text-xs text-textMuted">
            {mode === 'login' ? 'Enter credentials to access your control plane.' : 'Start monitoring your agents in minutes.'}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-textMuted" htmlFor="name">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-textMuted" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-textMuted" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent font-mono"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs font-medium text-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="gradient-brand w-full rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-lg glow-accent transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Authenticating…' : mode === 'login' ? 'Sign In to Control Plane' : 'Create Account'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="mt-6 text-xs text-textMuted hover:text-white transition underline decoration-white/20 underline-offset-4"
          >
            {mode === 'login' ? "Need an account? Register new user" : 'Already registered? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
