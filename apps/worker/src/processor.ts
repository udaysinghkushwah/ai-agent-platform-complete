import { Job } from 'bullmq';
import { Prisma, PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { TelemetryJobData } from './types';
import { applyPrivacySettings } from './privacy';

const prisma = new PrismaClient();
const redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

class DeadLetterError extends Error {}

function requireField(value: unknown, field: string): void {
  if (value === undefined || value === null || value === '') {
    throw new DeadLetterError(`Missing required field: ${field}`);
  }
}

/**
 * Ensures a Trace row exists for this (projectId, traceId), creating it from
 * the first span seen for it. Safe to call concurrently for spans of the
 * same trace — relies on the DB unique constraint + upsert, not
 * application-level locking.
 */
async function ensureTrace(data: TelemetryJobData) {
  const { event, organizationId, projectId } = data;

  try {
    return await prisma.trace.upsert({
      where: { projectId_traceId: { projectId, traceId: event.traceId } },
      update: {}, // existence is all we need here; aggregates updated separately below
      create: {
        organizationId,
        projectId,
        traceId: event.traceId,
        sessionId: event.sessionId,
        agentId: event.agentId,
        agentVersion: event.agentVersion,
        environment: event.environment,
        status: 'in_progress',
        startedAt: new Date(event.startedAt),
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const existing = await prisma.trace.findUnique({
        where: { projectId_traceId: { projectId, traceId: event.traceId } },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

async function upsertSpan(
  data: TelemetryJobData,
  traceDbId: string,
  privacySettings: { disableRawPayloadStorage: boolean; sensitiveFieldMasks: string[] },
) {
  const { event, organizationId, projectId } = data;
  const { metadata, payloadReference } = applyPrivacySettings(
    event.metadata,
    event.payloadReference,
    privacySettings,
  );

  // eventId has a unique constraint — if a retried send races this exact
  // job, the create fails with P2002 and we treat it as "already processed"
  // rather than erroring the job.
  try {
    await prisma.span.create({
      data: {
        traceDbId,
        organizationId,
        projectId,
        spanId: event.spanId,
        parentSpanId: event.parentSpanId,
        eventId: event.eventId,
        eventType: event.eventType,
        name: event.name,
        provider: event.provider,
        model: event.model,
        status: event.status ?? 'ok',
        errorMessage: event.errorMessage,
        startedAt: new Date(event.startedAt),
        durationMs: event.durationMs,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cost: event.cost !== undefined ? new Prisma.Decimal(event.cost) : undefined,
        metadata: (metadata ?? undefined) as any,
        payloadReference,
        schemaVersion: event.schemaVersion ?? '1',
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return; // duplicate delivery — idempotent no-op
    }
    throw err;
  }
}

/**
 * Rolls the span's contribution into the parent trace's aggregates. Uses
 * atomic `increment` for additive fields so concurrent spans on the same
 * trace never lose an update to a race condition.
 */
async function updateTraceAggregates(data: TelemetryJobData, traceDbId: string) {
  const { event } = data;
  const spanEnd = new Date(
    new Date(event.startedAt).getTime() + (event.durationMs ?? 0),
  );

  await prisma.trace.update({
    where: { id: traceDbId },
    data: {
      totalCost:
        event.cost !== undefined
          ? { increment: new Prisma.Decimal(event.cost) }
          : undefined,
      totalInputTokens:
        event.inputTokens !== undefined ? { increment: event.inputTokens } : undefined,
      totalOutputTokens:
        event.outputTokens !== undefined ? { increment: event.outputTokens } : undefined,
      // A single erroring span marks the whole trace as error; nothing
      // downstream should need to scan every span to know a trace failed.
      status: event.status === 'error' ? 'error' : undefined,
    },
  });

  // Spans can arrive out of order (retries, parallel tool calls, network
  // jitter), so endedAt must only ever move forward, never backward. Plain
  // increments can't express "max of", so this is a targeted raw update
  // guarded by a WHERE clause instead of a read-then-write race.
  await prisma.$executeRaw`
    UPDATE traces
    SET "endedAt" = ${spanEnd}
    WHERE id = ${traceDbId} AND ("endedAt" IS NULL OR "endedAt" < ${spanEnd})
  `;
}

async function sendToDeadLetter(data: TelemetryJobData, reason: string) {
  await prisma.ingestionDeadLetter.create({
    data: {
      organizationId: data.organizationId,
      projectId: data.projectId,
      reason,
      rawPayload: data as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function processTelemetryJob(job: Job<TelemetryJobData>): Promise<void> {
  const data = job.data;

  try {
    requireField(data.event?.eventId, 'eventId');
    requireField(data.event?.traceId, 'traceId');
    requireField(data.event?.spanId, 'spanId');
    requireField(data.event?.startedAt, 'startedAt');
    requireField(data.projectId, 'projectId');

    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) {
      throw new DeadLetterError(`Unknown projectId: ${data.projectId}`);
    }

    const trace = await ensureTrace(data);
    await upsertSpan(data, trace.id, {
      disableRawPayloadStorage: project.disableRawPayloadStorage,
      sensitiveFieldMasks: project.sensitiveFieldMasks,
    });
    await updateTraceAggregates(data, trace.id);

    // Publish trace stream event for real-time SSE subscribers
    redisPublisher.publish(
      `trace_stream:${data.projectId}`,
      JSON.stringify({
        id: trace.id,
        traceId: data.event.traceId,
        sessionId: data.event.sessionId,
        agentId: data.event.agentId || 'default-agent',
        status: data.event.status || 'ok',
        startedAt: data.event.startedAt,
        spanCount: 1,
        totalCost: data.event.cost ? Number(data.event.cost) : 0,
        totalInputTokens: data.event.inputTokens || 0,
        totalOutputTokens: data.event.outputTokens || 0,
      }),
    ).catch(() => {});
  } catch (err) {
    if (err instanceof DeadLetterError) {
      // Malformed/unroutable event: don't retry it forever, park it for
      // inspection and let the job succeed so BullMQ doesn't keep hammering
      // on something that will never become valid.
      await sendToDeadLetter(data, err.message);
      return;
    }
    // Anything else (DB temporarily down, etc.) — rethrow so BullMQ's
    // retry/backoff (configured at enqueue time) kicks in.
    throw err;
  }
}

export { prisma };
