import { IsISO8601, IsOptional } from 'class-validator';

export class SummaryQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string; // defaults to 24h ago if omitted

  @IsOptional()
  @IsISO8601()
  to?: string; // defaults to now if omitted
}
