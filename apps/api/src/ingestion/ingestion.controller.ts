import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ApiKeyGuard } from './api-key.guard';
import { CurrentApiKeyContext } from './current-api-key-context.decorator';
import { ApiKeyContext } from './api-key.guard';
import { IngestionService } from './ingestion.service';
import { IngestBatchDto } from './dto/ingest-event.dto';

@Controller('ingest')
@UseGuards(ApiKeyGuard)
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post()
  // Ingestion is high-volume by design; this limit is per API key's IP in
  // front of the queue, not a substitute for the queue's own backpressure.
  @Throttle({ default: { limit: 1000, ttl: 60_000 } })
  async ingest(
    @CurrentApiKeyContext() ctx: ApiKeyContext,
    @Body() dto: IngestBatchDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.ingestion.ingestBatch(ctx, dto.events);
    // 402 for a quota rejection (distinct from a validation 4xx or a 202
    // accept) so the SDK can tell "you're over your plan" apart from
    // "something's wrong with this payload" and surface it accordingly.
    res.status(result.rejected > 0 ? HttpStatus.PAYMENT_REQUIRED : HttpStatus.ACCEPTED);
    return result;
  }
}
