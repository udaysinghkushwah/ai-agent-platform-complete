import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ArrayNotEmpty,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const EVENT_TYPES = ['llm', 'retrieval', 'tool', 'generic'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * One span event as sent by the SDK. Mirrors the event envelope in the
 * Detailed Database/API/Event Design spec: every field the trace explorer
 * (MVP-2) and evaluators (MVP-3/4) will need is captured at ingestion time
 * rather than backfilled later.
 */
export class IngestEventDto {
  @IsString()
  eventId!: string; // idempotency key

  @IsString()
  traceId!: string;

  @IsString()
  spanId!: string;

  @IsOptional()
  @IsString()
  parentSpanId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsIn(EVENT_TYPES)
  eventType!: EventType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  agentVersion?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsIn(['ok', 'error'])
  status?: 'ok' | 'error';

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsISO8601()
  startedAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  inputTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  outputTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  payloadReference?: string;

  @IsOptional()
  @IsString()
  schemaVersion?: string;
}

export class IngestBatchDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(500) // keep individual ingestion payloads bounded; SDK batches beyond this client-side
  @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}
