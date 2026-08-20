import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IngestEventDto } from './dto/ingest-event.dto';
import { ApiKeyContext } from './api-key.guard';
import { TELEMETRY_QUEUE } from './ingestion.constants';
import { QuotaService } from '../billing/quota.service';

export interface TelemetryJobData {
  organizationId: string;
  projectId: string;
  event: IngestEventDto;
  receivedAt: string;
}

export interface IngestResult {
  accepted: number;
  rejected: number;
  quota?: { currentUsage: number; limit: number };
}

@Injectable()
export class IngestionService {
  constructor(
    @InjectQueue(TELEMETRY_QUEUE) private readonly queue: Queue<TelemetryJobData>,
    private readonly quota: QuotaService,
  ) {}

  /**
   * Enqueues events and returns immediately — actual DB writes happen in the
   * worker (apps/worker). This is what keeps ingestion from adding latency
   * to a customer's agent: we do the minimum work needed to durably accept
   * the event, nothing more, before responding.
   *
   * Quota is checked via Redis (see QuotaService), not a Postgres query,
   * for the same latency reason. Over quota rejects the *whole* batch
   * rather than partially accepting it — a partial-batch outcome would be
   * a confusing contract for the SDK to handle (which events landed?).
   */
  async ingestBatch(ctx: ApiKeyContext, events: IngestEventDto[]): Promise<IngestResult> {
    const quotaCheck = await this.quota.checkAndIncrementTraceUsage(ctx.organizationId, events.length);
    if (!quotaCheck.allowed) {
      return {
        accepted: 0,
        rejected: events.length,
        quota: { currentUsage: quotaCheck.currentUsage, limit: quotaCheck.limit },
      };
    }

    const receivedAt = new Date().toISOString();

    await this.queue.addBulk(
      events.map((event) => ({
        name: 'telemetry-event',
        data: {
          organizationId: ctx.organizationId,
          projectId: ctx.projectId,
          event,
          receivedAt,
        },
        opts: {
          // eventId is the SDK's idempotency key — reusing it as the BullMQ
          // job ID means a retried HTTP request that re-enqueues the same
          // event is deduplicated at the queue level too, before it ever
          // reaches the worker/DB.
          jobId: event.eventId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      })),
    );

    return { accepted: events.length, rejected: 0 };
  }
}
