import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TraceQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['in_progress', 'ok', 'error'])
  status?: 'in_progress' | 'ok' | 'error';

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  // Matches against traceId or sessionId — good enough for MVP-2; a real
  // full-text/trace-content search is a later-phase concern.
  @IsOptional()
  @IsString()
  search?: string;

  // Cursor = a trace's internal id. We paginate on (startedAt, id) so results
  // stay stable even as new traces stream in concurrently.
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}
