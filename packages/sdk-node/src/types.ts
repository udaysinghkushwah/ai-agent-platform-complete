export type EventType = 'llm' | 'retrieval' | 'tool' | 'generic';

export interface SpanEvent {
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

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Max events buffered before a forced flush. Default 20. */
  batchSize?: number;
  /** Max time an event waits in the buffer before a forced flush, ms. Default 5000. */
  flushIntervalMs?: number;
  /** Max retry attempts per batch send. Default 3. */
  maxRetries?: number;
}
