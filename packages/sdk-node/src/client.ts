import { randomUUID } from 'crypto';
import { ClientOptions, SpanEvent, EventType } from './types';

const DEFAULT_BASE_URL = 'https://api.your-aap-domain.com';
const MAX_BUFFERED_EVENTS = 5000; // hard ceiling so a stuck network never grows this unbounded

export interface SpanEndInput {
  status?: 'ok' | 'error';
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  metadata?: Record<string, unknown>;
  payloadReference?: string;
}

export interface StartSpanInput {
  eventType: EventType;
  name?: string;
  parentSpanId?: string;
  provider?: string;
  model?: string;
}

export class SpanHandle {
  readonly spanId: string;
  readonly traceId: string;
  private readonly startedAtMs: number;
  private readonly startedAtIso: string;
  private ended = false;

  constructor(
    private readonly client: AapClient,
    traceId: string,
    private readonly base: StartSpanInput,
  ) {
    this.traceId = traceId;
    this.spanId = randomUUID();
    this.startedAtMs = Date.now();
    this.startedAtIso = new Date(this.startedAtMs).toISOString();
  }

  end(result: SpanEndInput = {}): void {
    if (this.ended) return; // end() is idempotent — safe to call from a finally block after an early return
    this.ended = true;

    const event: SpanEvent = {
      eventId: randomUUID(),
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.base.parentSpanId,
      eventType: this.base.eventType,
      name: this.base.name,
      provider: this.base.provider,
      model: this.base.model,
      status: result.status ?? 'ok',
      errorMessage: result.errorMessage,
      startedAt: this.startedAtIso,
      durationMs: Date.now() - this.startedAtMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost: result.cost,
      metadata: result.metadata,
      payloadReference: result.payloadReference,
      schemaVersion: '1',
    };

    this.client._enqueue(event);
  }
}

export interface StartTraceInput {
  sessionId?: string;
  agentId?: string;
  agentVersion?: string;
  environment?: string;
}

export class Trace {
  readonly traceId: string;

  constructor(
    private readonly client: AapClient,
    private readonly meta: StartTraceInput,
  ) {
    this.traceId = randomUUID();
  }

  startSpan(input: StartSpanInput): SpanHandle {
    return new SpanHandle(this.client, this.traceId, input);
  }
}

export class AapClient {
  private buffer: SpanEvent[] = [];
  private readonly baseUrl: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sending = false;

  constructor(private readonly options: ClientOptions) {
    if (!options.apiKey) {
      throw new Error('AapClient requires an apiKey');
    }
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.batchSize = options.batchSize ?? 20;
    this.flushIntervalMs = options.flushIntervalMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 3;

    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    // Don't let the flush timer keep the customer's process alive on its own.
    this.timer.unref?.();
  }

  startTrace(meta: StartTraceInput = {}): Trace {
    return new Trace(this, meta);
  }

  /** @internal used by SpanHandle */
  _enqueue(event: SpanEvent): void {
    if (this.buffer.length >= MAX_BUFFERED_EVENTS) {
      // Backpressure: drop the oldest rather than grow unbounded or block
      // the customer's agent. A dropped event here means the customer's
      // network/the platform has been down long enough to matter more than
      // one missing span will.
      this.buffer.shift();
    }
    this.buffer.push(event);
    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  /** Force-send whatever is buffered right now. Call before process exit. */
  async flush(): Promise<void> {
    if (this.sending || this.buffer.length === 0) return;
    this.sending = true;

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.sendWithRetry(batch);
    } finally {
      this.sending = false;
    }
  }

  private async sendWithRetry(batch: SpanEvent[]): Promise<void> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const res = await fetch(`${this.baseUrl}/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.options.apiKey}`,
          },
          body: JSON.stringify({ events: batch }),
        });

        if (res.ok) return;

        // 4xx (other than 429) means the payload/auth is wrong — retrying
        // won't help, so don't burn attempts on it.
        if (res.status < 500 && res.status !== 429) {
          console.error(`[aap-sdk] ingestion rejected batch: HTTP ${res.status}`);
          return;
        }
      } catch {
        // network error — fall through to retry
      }

      attempt += 1;
      const delay = 2 ** attempt * 250;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    console.error(`[aap-sdk] failed to send ${batch.length} event(s) after ${this.maxRetries} attempts`);
  }

  /** Stop the background flush timer. Call on graceful shutdown. */
  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}

export function createClient(options: ClientOptions): AapClient {
  return new AapClient(options);
}
