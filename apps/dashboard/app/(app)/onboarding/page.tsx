'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { orgs, projects as projectsApi, ApiError } from '@/lib/api';
import { Copy, Check, Terminal, Code2, ShieldCheck } from 'lucide-react';

export default function OnboardingPage() {
  const session = useSession();
  const [orgName, setOrgName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'org' | 'project' | 'done'>('org');
  const [snippetTab, setSnippetTab] = useState<'node' | 'python' | 'policy'>('python');
  const [copiedStep1, setCopiedStep1] = useState(false);
  const [copiedStep2, setCopiedStep2] = useState(false);
  const [copiedStep3, setCopiedStep3] = useState(false);

  useEffect(() => {
    if (session.organizationId) setStep(session.projectId ? 'done' : 'project');
  }, [session.organizationId, session.projectId]);

  async function createOrg() {
    setError(null);
    try {
      const org = await orgs.create(orgName);
      session.setOrganization(org.id);
      setStep('project');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create organization');
    }
  }

  async function createProject() {
    if (!session.organizationId) return;
    setError(null);
    try {
      const project = await projectsApi.create(session.organizationId, projectName, environment);
      session.setProject(project.id);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create project');
    }
  }

  const copyToClipboard = (text: string, setFn: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto text-slate-100 font-sans">
      {/* Title Header Banner */}
      <div className="text-center space-y-2 border-b border-slate-800 pb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Code Integration & Onboarding</h1>
        <p className="text-xs text-slate-400 font-mono">Streamline your development with our SDKs and Policies.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/60 p-4 text-xs font-bold text-rose-400">
          {error}
        </div>
      )}

      {/* Language Snippet Tabs Bar with Perfectly Aligned Lucide SVG Icons */}
      <div className="flex flex-wrap items-center justify-center border-b border-slate-800 pb-3 gap-8">
        <button
          onClick={() => setSnippetTab('node')}
          className={`flex items-center gap-2 text-xs font-extrabold transition pb-2.5 border-b-2 ${
            snippetTab === 'node'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="h-4 w-4 shrink-0" />
          <span>Node.js SDK</span>
        </button>

        <button
          onClick={() => setSnippetTab('python')}
          className={`flex items-center gap-2 text-xs font-extrabold transition pb-2.5 border-b-2 ${
            snippetTab === 'python'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Code2 className="h-4 w-4 shrink-0" />
          <span>Python SDK</span>
        </button>

        <button
          onClick={() => setSnippetTab('policy')}
          className={`flex items-center gap-2 text-xs font-extrabold transition pb-2.5 border-b-2 ${
            snippetTab === 'policy'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Governance Policy Check</span>
        </button>
      </div>

      {/* Main Python Integration Card */}
      {snippetTab === 'python' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 md:p-8 shadow-xl space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <Code2 className="h-5 w-5 text-emerald-400" />
              <span>Python SDK Integration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Python SDK integration for your agents and real-time governance solutions.{' '}
              <a href="https://pypi.org/project/aap-sdk" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                Learn more.
              </a>
            </p>
          </div>

          {/* Step 1: Install SDK */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Step 1: Install the SDK</span>
              <button
                onClick={() => copyToClipboard('pip install aap-sdk', setCopiedStep1)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition"
              >
                {copiedStep1 ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedStep1 ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="rounded-lg bg-slate-900/90 border border-slate-800/80 p-3 font-mono text-xs text-cyan-400 flex items-center gap-2">
              <span className="text-slate-600">$</span>
              <span>pip install aap-sdk</span>
            </div>
          </div>

          {/* Step 2: Initialize AapClient */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Step 2: Initialize AapClient</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `from aap_sdk import AapClient\nclient = AapClient(\n    api_key="AAP_API_KEY_HERE",\n    project_id="${session.projectId || 'PROJ-8A1B-2C3D'}"\n)`,
                    setCopiedStep2
                  )
                }
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition"
              >
                {copiedStep2 ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedStep2 ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="rounded-lg bg-slate-900/90 border border-slate-800/80 p-3 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
{`from aap_sdk import AapClient

# Initialize the client with API key
client = AapClient(
    api_key="AAP_API_KEY_HERE",
    project_id="${session.projectId || 'PROJ-8A1B-2C3D'}"
)
print("AAP Client initialized successfully.")`}
            </pre>
          </div>

          {/* Step 3: Add Tracing to Methods */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Step 3: Add Tracing to Methods</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `from aap_sdk.tracing import trace_span\n\n@trace_span(name="process_data", service="InventoryService")\ndef process_inventory_data(data_payload: dict) -> bool:\n    print(f"Processing data: {data_payload['id']}")\n    return True`,
                    setCopiedStep3
                  )
                }
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition"
              >
                {copiedStep3 ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedStep3 ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="rounded-lg bg-slate-900/90 border border-slate-800/80 p-3 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
{`from aap_sdk.tracing import trace_span

@trace_span(name="process_data", service="InventoryService")
def process_inventory_data(data_payload: dict) -> bool:
    """Processes incoming data with tracing."""
    print(f"Processing data: {data_payload['id']}")
    # Business logic goes here
    return True

# Example usage:
data = {"id": "SKU-491", "quantity": 150}
result = process_inventory_data(data)`}
            </pre>
          </div>
        </div>
      )}

      {/* Node.js Integration Card */}
      {snippetTab === 'node' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 md:p-8 shadow-xl space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <Terminal className="h-5 w-5 text-cyan-400" />
              <span>Node.js SDK Integration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Official Node.js SDK (`@aap/sdk-node`) for non-blocking agent telemetry.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <span className="text-xs font-bold text-slate-300">Step 1: Install Package</span>
            <div className="rounded-lg bg-slate-900/90 border border-slate-800/80 p-3 font-mono text-xs text-cyan-400 flex items-center gap-2">
              <span className="text-slate-600">$</span>
              <span>npm install @aap/sdk-node</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <span className="text-xs font-bold text-slate-300">Step 2: Instrument Telemetry</span>
            <pre className="rounded-lg bg-slate-900/90 border border-slate-800/80 p-3 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
{`import { createClient } from '@aap/sdk-node';

const aap = createClient({
  apiKey: process.env.AAP_API_KEY,
  baseUrl: 'http://localhost:3000',
});

const trace = aap.startTrace({ agentId: 'customer-support-agent' });
const span = trace.startSpan({ eventType: 'llm', provider: 'openai', model: 'gpt-4o' });

span.end({
  status: 'ok',
  inputTokens: 145,
  outputTokens: 68,
  cost: 0.0032
});

await aap.flush();`}
            </pre>
          </div>
        </div>
      )}

      {/* Policy Check Integration Card */}
      {snippetTab === 'policy' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 md:p-8 shadow-xl space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-400" />
              <span>Governance Policy Check</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Evaluate tool execution policies before executing high-risk operations.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <span className="text-xs font-bold text-slate-300">Policy Interceptor Request</span>
            <pre className="rounded-lg bg-slate-900/90 border border-slate-800/80 p-3 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
{`const res = await fetch('http://localhost:3000/policy-checks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${apiKey}\`
  },
  body: JSON.stringify({
    toolName: 'send_wire_transfer',
    environment: 'production'
  })
});

const policy = await res.json();
if (policy.outcome === 'REQUIRES_APPROVAL') {
  console.warn('Execution paused for human review:', policy.reason);
}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
