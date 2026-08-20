export type EventType = 'llm' | 'retrieval' | 'tool' | 'generic';

export interface IngestEvent {
  eventId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sessionId?: string;
  eventType: EventType;
  name?: string;
  agentId?: string;
  agentVersion?: string;
  environment?: string;
  provider?: string;
  model?: string;
  status?: 'ok' | 'error';
  errorMessage?: string;
  startedAt: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  metadata?: Record<string, unknown>;
  payloadReference?: string;
  schemaVersion?: string;
}

export interface TelemetryJobData {
  organizationId: string;
  projectId: string;
  event: IngestEvent;
  receivedAt: string;
}
