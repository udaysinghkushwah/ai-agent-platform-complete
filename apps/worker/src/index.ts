import 'dotenv/config';
import { Worker, QueueEvents, Queue } from 'bullmq';
import { processTelemetryJob, prisma } from './processor';
import { processEvaluationJob } from './evaluation-processor';
import { checkAlertRules } from './alert-checker';
import { cleanupExpiredTraces } from './retention';

const TELEMETRY_QUEUE = 'telemetry-ingestion';
const EVALUATION_QUEUE = 'evaluation-runs';
const ALERT_CHECK_QUEUE = 'alert-checks';
const RETENTION_QUEUE = 'retention-cleanup';

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const telemetryConcurrency = Number(process.env.WORKER_CONCURRENCY ?? 10);
// Evaluation jobs can make outbound LLM-judge calls, which are much slower
// than a DB write — lower default concurrency so one run doesn't monopolize
// every worker slot and starve telemetry ingestion.
const evaluationConcurrency = Number(process.env.EVAL_WORKER_CONCURRENCY ?? 4);
const alertCheckIntervalMs = Number(process.env.ALERT_CHECK_INTERVAL_MS ?? 60_000);
const retentionIntervalMs = Number(process.env.RETENTION_CHECK_INTERVAL_MS ?? 24 * 60 * 60 * 1000);

const telemetryWorker = new Worker(TELEMETRY_QUEUE, processTelemetryJob, {
  connection,
  concurrency: telemetryConcurrency,
});

const evaluationWorker = new Worker(EVALUATION_QUEUE, processEvaluationJob, {
  connection,
  concurrency: evaluationConcurrency,
});

// Scheduled work (alert checks, retention cleanup) uses BullMQ's repeatable
// jobs rather than a plain setInterval specifically so that running
// multiple worker instances (horizontal scaling) doesn't run N duplicate
// copies of the cron — BullMQ's repeat scheduling is queue-level, workers
// just compete to process the single scheduled job instance.
const alertCheckQueue = new Queue(ALERT_CHECK_QUEUE, { connection });
const retentionQueue = new Queue(RETENTION_QUEUE, { connection });

const alertCheckWorker = new Worker(
  ALERT_CHECK_QUEUE,
  async () => {
    await checkAlertRules();
  },
  { connection, concurrency: 1 },
);

const retentionWorker = new Worker(
  RETENTION_QUEUE,
  async () => {
    await cleanupExpiredTraces();
  },
  { connection, concurrency: 1 },
);

const telemetryEvents = new QueueEvents(TELEMETRY_QUEUE, { connection });
const evaluationEvents = new QueueEvents(EVALUATION_QUEUE, { connection });

telemetryWorker.on('completed', (job) => {
  console.log(`[worker:telemetry] processed ${job.id}`);
});
telemetryWorker.on('failed', (job, err) => {
  console.error(`[worker:telemetry] job ${job?.id} failed after retries:`, err.message);
});

evaluationWorker.on('completed', (job) => {
  console.log(`[worker:evaluation] scored case ${job.id}`);
});
evaluationWorker.on('failed', (job, err) => {
  console.error(`[worker:evaluation] job ${job?.id} failed after retries:`, err.message);
});

alertCheckWorker.on('failed', (job, err) => {
  console.error('[worker:alert-check] check cycle failed:', err.message);
});
retentionWorker.on('failed', (job, err) => {
  console.error('[worker:retention] cleanup cycle failed:', err.message);
});

telemetryEvents.on('error', (err) => console.error('[worker:telemetry] queue events error:', err));
evaluationEvents.on('error', (err) => console.error('[worker:evaluation] queue events error:', err));

async function scheduleRepeatingJobs() {
  // jobId makes this idempotent — restarting the worker (or running several
  // instances) won't stack up duplicate repeatable schedules.
  await alertCheckQueue.add(
    'check',
    {},
    { repeat: { every: alertCheckIntervalMs }, jobId: 'alert-check-schedule' },
  );
  await retentionQueue.add(
    'cleanup',
    {},
    { repeat: { every: retentionIntervalMs }, jobId: 'retention-cleanup-schedule' },
  );
  console.log(
    `[worker] scheduled alert checks every ${alertCheckIntervalMs}ms and retention cleanup every ${retentionIntervalMs}ms`,
  );
}

scheduleRepeatingJobs().catch((err) => console.error('[worker] failed to schedule repeating jobs:', err));

console.log(
  `[worker] listening on "${TELEMETRY_QUEUE}" (concurrency ${telemetryConcurrency}) and "${EVALUATION_QUEUE}" (concurrency ${evaluationConcurrency})`,
);

async function shutdown() {
  console.log('[worker] shutting down...');
  await Promise.all([
    telemetryWorker.close(),
    evaluationWorker.close(),
    alertCheckWorker.close(),
    retentionWorker.close(),
  ]);
  await Promise.all([telemetryEvents.close(), evaluationEvents.close()]);
  await Promise.all([alertCheckQueue.close(), retentionQueue.close()]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
