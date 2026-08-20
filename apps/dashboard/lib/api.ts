const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('aap_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────
export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export const auth = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
};

// ── Organizations / Projects ────────────────────────────────────────
export interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  environment: string;
  status: string;
  disableRawPayloadStorage?: boolean;
  sensitiveFieldMasks?: string[];
  retentionDays?: number | null;
  webhookUrl?: string | null;
  slackWebhookUrl?: string | null;
}

export const orgs = {
  list: () => request<Organization[]>('/organizations'),
  create: (name: string) => request<Organization>('/organizations', { method: 'POST', body: JSON.stringify({ name }) }),
};

export const projects = {
  listForOrg: (orgId: string) => request<Project[]>(`/organizations/${orgId}/projects`),
  getOne: (projectId: string) => request<Project>(`/projects/${projectId}`),
  create: (orgId: string, name: string, environment?: string) =>
    request<Project>(`/organizations/${orgId}/projects`, {
      method: 'POST',
      body: JSON.stringify({ name, environment }),
    }),
  updateIntegrations: (
    projectId: string,
    body: { webhookUrl?: string; slackWebhookUrl?: string },
  ) =>
    request<Project>(`/projects/${projectId}/integrations`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

// ── API Keys ─────────────────────────────────────────────────────────
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  key: string; // raw key — only present on the create response
}

export const apiKeys = {
  list: (projectId: string) => request<ApiKeySummary[]>(`/projects/${projectId}/api-keys`),
  create: (projectId: string, name?: string) =>
    request<CreatedApiKey>(`/projects/${projectId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  revoke: (projectId: string, keyId: string) =>
    request<ApiKeySummary>(`/projects/${projectId}/api-keys/${keyId}`, { method: 'DELETE' }),
};

// ── Analytics ────────────────────────────────────────────────────────
export interface DashboardSummary {
  range: { from: string; to: string };
  requests: number;
  errorRate: number;
  latencyMs: { p50: number | null; p95: number | null; p99: number | null };
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  topModels: { model: string; requestCount: number; totalCost: number }[];
  topFailingAgents: { agentId: string; errorCount: number }[];
}

export interface TraceListItem {
  id: string;
  traceId: string;
  sessionId: string | null;
  agentId: string | null;
  agentVersion: string | null;
  environment: string | null;
  status: 'in_progress' | 'ok' | 'error';
  startedAt: string;
  endedAt: string | null;
  spanCount: number;
  totalCost: number;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
}

export interface TraceListResponse {
  items: TraceListItem[];
  nextCursor: string | null;
}

export interface SpanDetail {
  id: string;
  spanId: string;
  parentSpanId: string | null;
  eventType: string;
  name: string | null;
  provider: string | null;
  model: string | null;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  metadata: Record<string, unknown> | null;
}

export interface TraceDetail extends TraceListItem {
  spans: SpanDetail[];
}

export interface TraceFilters {
  status?: string;
  agentId?: string;
  environment?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export const analytics = {
  summary: (projectId: string) => request<DashboardSummary>(`/projects/${projectId}/analytics/summary`),
  listTraces: (projectId: string, filters: TraceFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const qs = params.toString();
    return request<TraceListResponse>(`/projects/${projectId}/traces${qs ? `?${qs}` : ''}`);
  },
  traceDetail: (projectId: string, traceId: string) =>
    request<TraceDetail>(`/projects/${projectId}/traces/${traceId}`),
  streamTraces: (projectId: string, onTrace: (trace: TraceListItem) => void) => {
    const controller = new AbortController();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    fetch(`${baseUrl}/projects/${projectId}/traces/stream`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const dataLine = line.split('\n').find((l) => l.startsWith('data: '));
            if (dataLine) {
              try {
                const data = JSON.parse(dataLine.replace('data: ', ''));
                onTrace(data);
              } catch {
                // ignore parse error
              }
            }
          }
        }
      })
      .catch(() => {});

    return () => controller.abort();
  },
};

// ── Evaluation ───────────────────────────────────────────────────────
export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  caseCount: number;
  runCount: number;
  createdAt: string;
}

export interface DatasetCase {
  id: string;
  caseKey: string;
  input: unknown;
  expectedOutput: unknown;
  context: unknown;
  metadata: unknown;
  tags: string[];
}

export interface EvaluationRunSummary {
  id: string;
  name: string | null;
  datasetId: string;
  agentId: string | null;
  agentVersion: string | null;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  verdict: 'PASS' | 'WARN' | 'FAIL' | null;
  overallScore: number | null;
  passRate: number | null;
  totalCases: number;
  completedCases: number;
  degradedCases: number;
  createdAt: string;
  completedAt: string | null;
}

export interface EvaluationResultItem {
  id: string;
  datasetCaseId: string;
  evaluatorType: string;
  score: number | null;
  passed: boolean;
  degraded: boolean;
  reasoning: string | null;
  submittedOutput: unknown;
  judgeModel: string | null;
  createdAt: string;
  datasetCase: { caseKey: string; input: unknown; expectedOutput: unknown };
}

export interface EvaluationRunDetail extends EvaluationRunSummary {
  results: EvaluationResultItem[];
}

export const evaluation = {
  listDatasets: (projectId: string) => request<Dataset[]>(`/projects/${projectId}/datasets`),
  createDataset: (projectId: string, name: string, description?: string) =>
    request<Dataset>(`/projects/${projectId}/datasets`, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  listCases: (projectId: string, datasetId: string) =>
    request<DatasetCase[]>(`/projects/${projectId}/datasets/${datasetId}/cases`),
  addCases: (projectId: string, datasetId: string, cases: unknown[]) =>
    request<{ upserted: number }>(`/projects/${projectId}/datasets/${datasetId}/cases`, {
      method: 'POST',
      body: JSON.stringify({ cases }),
    }),
  createRun: (
    projectId: string,
    datasetId: string,
    body: { name?: string; agentId?: string; agentVersion?: string; evaluators: unknown[]; outputs: unknown[] },
  ) =>
    request<EvaluationRunSummary>(`/projects/${projectId}/datasets/${datasetId}/runs`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listRuns: (projectId: string, datasetId?: string) =>
    request<EvaluationRunSummary[]>(`/projects/${projectId}/runs${datasetId ? `?datasetId=${datasetId}` : ''}`),
  runDetail: (projectId: string, runId: string) =>
    request<EvaluationRunDetail>(`/projects/${projectId}/runs/${runId}`),
};

// ── Alerts ───────────────────────────────────────────────────────────
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  comparator: string;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  notifyEmails: string[];
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  alertRuleId: string;
  metricValue: number;
  threshold: number;
  message: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  triggeredAt: string;
  resolvedAt: string | null;
  notified: boolean;
  notifyError: string | null;
  rule: { name: string; metric: string };
}

export const alerts = {
  listRules: (projectId: string) => request<AlertRule[]>(`/projects/${projectId}/alert-rules`),
  createRule: (
    projectId: string,
    body: {
      name: string;
      metric: string;
      comparator: string;
      threshold: number;
      windowMinutes?: number;
      cooldownMinutes?: number;
      notifyEmails?: string[];
    },
  ) => request<AlertRule>(`/projects/${projectId}/alert-rules`, { method: 'POST', body: JSON.stringify(body) }),
  setRuleStatus: (projectId: string, ruleId: string, status: 'ACTIVE' | 'PAUSED') =>
    request<AlertRule>(`/projects/${projectId}/alert-rules/${ruleId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  listEvents: (projectId: string, status?: string) =>
    request<AlertEvent[]>(`/projects/${projectId}/alert-events${status ? `?status=${status}` : ''}`),
  setEventStatus: (projectId: string, eventId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') =>
    request<AlertEvent>(`/projects/${projectId}/alert-events/${eventId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// ── Governance ───────────────────────────────────────────────────────
export interface GovernancePolicy {
  id: string;
  name: string;
  allowedTools: string[];
  blockedTools: string[];
  requireApprovalTools: string[];
  restrictedEnvironments: string[];
  maxParameterValues: Record<string, Record<string, number>> | null;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
}

export const governance = {
  listPolicies: (projectId: string) => request<GovernancePolicy[]>(`/projects/${projectId}/governance-policies`),
  createPolicy: (
    projectId: string,
    body: {
      name: string;
      allowedTools?: string[];
      blockedTools?: string[];
      requireApprovalTools?: string[];
      restrictedEnvironments?: string[];
    },
  ) =>
    request<GovernancePolicy>(`/projects/${projectId}/governance-policies`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  setPolicyStatus: (projectId: string, policyId: string, status: 'ACTIVE' | 'PAUSED') =>
    request<GovernancePolicy>(`/projects/${projectId}/governance-policies/${policyId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export interface PendingApprovalItem {
  id: string;
  projectId: string;
  toolName: string;
  environment: string;
  parameters: Record<string, unknown> | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export const approvals = {
  list: (projectId: string) => request<PendingApprovalItem[]>(`/projects/${projectId}/approvals`),
  resolve: (projectId: string, approvalId: string, action: 'APPROVE' | 'REJECT') =>
    request<PendingApprovalItem>(`/projects/${projectId}/approvals/${approvalId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
};

// ── Audit log ────────────────────────────────────────────────────────
export interface AuditEventItem {
  id: string;
  organizationId: string;
  projectId: string | null;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const audit = {
  list: (orgId: string, opts: { cursor?: string; resourceType?: string; projectId?: string } = {}) => {
    const params = new URLSearchParams();
    Object.entries(opts).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return request<{ items: AuditEventItem[]; nextCursor: string | null }>(
      `/organizations/${orgId}/audit-events${qs ? `?${qs}` : ''}`,
    );
  },
};

// ── Privacy settings ─────────────────────────────────────────────────
export const privacy = {
  update: (
    projectId: string,
    body: { disableRawPayloadStorage?: boolean; sensitiveFieldMasks?: string[]; retentionDays?: number | null },
  ) =>
    request<Project>(`/projects/${projectId}/privacy-settings`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

// ── Billing / usage ──────────────────────────────────────────────────
export interface UsageBucket {
  used: number;
  limit: number;
  percentUsed: number;
}

export interface UsageSnapshot {
  plan: string;
  planDisplayName: string;
  periodStart: string;
  traces: UsageBucket;
  evalCases: UsageBucket;
  teamMembers: UsageBucket;
  retentionDaysLimit: number;
  warnings: string[];
}

export const billing = {
  getUsage: (orgId: string) => request<UsageSnapshot>(`/organizations/${orgId}/usage`),
};

// ── Team ─────────────────────────────────────────────────────────────
export interface OrgMember {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

export const team = {
  list: (orgId: string) => request<OrgMember[]>(`/organizations/${orgId}/members`),
  invite: (orgId: string, email: string, role: string) =>
    request<OrgMember>(`/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  remove: (orgId: string, userId: string) =>
    request<{ removed: boolean }>(`/organizations/${orgId}/members/${userId}`, { method: 'DELETE' }),
};
