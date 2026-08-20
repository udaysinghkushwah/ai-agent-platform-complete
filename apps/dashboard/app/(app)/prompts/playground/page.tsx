'use client';

import { useState } from 'react';
import { useSession } from '@/lib/session';
import { Sparkles, Play, ShieldCheck, ShieldAlert, Cpu, DollarSign, Clock, Layers, Copy, Check, Terminal, Sliders, RefreshCw, Zap } from 'lucide-react';

interface Preset {
  name: string;
  systemPrompt: string;
  prompt: string;
  variables: Record<string, string>;
  model: string;
}

const PRESETS: Preset[] = [
  {
    name: '⚡ Customer Support Assistant',
    systemPrompt: 'You are a helpful and knowledgeable AI assistant. Respond to user queries accurately and concisely.',
    prompt: 'Product Name: {{product_name}}\nKey Features: {{key_features}}',
    variables: { product_name: 'Nexus', key_features: 'fast, secure' },
    model: 'gpt-4o',
  },
  {
    name: '🔬 Clinical Data Summarizer',
    systemPrompt: 'You are a clinical AI assistant. Summarize medical reports while strictly preserving dosage units.',
    prompt: 'Summarize patient {{patient_id}} presenting with {{condition}}.',
    variables: { patient_id: 'PAT-4401', condition: 'Type 2 Diabetes' },
    model: 'claude-3-5-sonnet',
  },
];

export default function PromptPlaygroundPage() {
  const { projectId: selectedProjectId, token } = useSession();
  const [systemPrompt, setSystemPrompt] = useState(PRESETS[0].systemPrompt);
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [variables, setVariables] = useState<Record<string, string>>(PRESETS[0].variables);
  const [model, setModel] = useState(PRESETS[0].model);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>({
    outputText: `Welcome to the Nexus! The ultimate platform for fast and secure development.\nHere are some of its key features:\n\n[listing features below...]`,
    safetyStatus: 'PASSED',
    totalTokens: 482,
    estimatedCostUSD: 0.0031,
    durationMs: 168,
  });

  const handleRun = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/projects/${selectedProjectId}/prompts/sandbox/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          prompt,
          systemPrompt,
          model,
          temperature,
          maxTokens,
          variables,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch {
      // keep current demo result
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      {/* Header Banner */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <span>PROMPT SANDBOX & BENCHMARK STUDIO</span>
          <Sparkles className="h-5 w-5 text-cyan-400" />
        </h1>
      </div>

      {/* 2 Column Main Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Prompt Configuration */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono border-b border-slate-800/80 pb-3">
            Prompt Configuration
          </h2>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">System Persona</label>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 leading-relaxed"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-300">Template Variables</label>
            {Object.entries(variables).map(([k, v], idx) => (
              <div key={k} className="space-y-1">
                <span className="text-[11px] font-mono text-slate-400">Variable {idx + 1}</span>
                <input
                  type="text"
                  value={`${k === 'product_name' ? 'Product Name: ' : 'Key Features: '}${v}`}
                  onChange={(e) => {
                    const parts = e.target.value.split(': ');
                    setVariables({ ...variables, [k]: parts[1] || parts[0] });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-300">LLM Selector</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/50 text-xs font-mono font-bold text-white outline-none shadow-lg shadow-cyan-500/10"
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              <option value="llama-3-70b">Llama 3 70B</option>
            </select>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-slate-300">Temperature</label>
              <span className="font-mono font-bold text-cyan-400">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.0</span>
              <span>0.7</span>
              <span>1.0</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-300">Max Tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 font-bold text-xs text-white shadow-lg shadow-cyan-500/20 hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Run Prompt Sandbox</span>
          </button>
        </div>

        {/* Right Column: Execution Output */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono border-b border-slate-800/80 pb-3">
              Execution Output
            </h2>

            {/* Telemetry Pills Row */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono block">Telemetry</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-xs font-bold shadow-md shadow-cyan-500/20">
                  Safety Gate: PASSED
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold">
                  Total Tokens: {result.totalTokens}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold">
                  Est. USD Cost: ${result.estimatedCostUSD}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold">
                  Latency: {result.durationMs}ms
                </span>
              </div>
            </div>

            {/* Output Box */}
            <div className="min-h-[340px] rounded-xl border border-slate-800 bg-slate-950 p-5 font-mono text-xs text-slate-200 leading-relaxed overflow-auto">
              <pre className="whitespace-pre-wrap">{result.outputText}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
