import { IsArray, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const ALERT_METRICS = [
  'ERROR_RATE',
  'LATENCY_P95',
  'COST',
  'EVAL_SCORE',
  'EVAL_REGRESSION',
  'TOOL_FAILURE_RATE',
] as const;

export const ALERT_COMPARATORS = ['GT', 'GTE', 'LT', 'LTE'] as const;

export class CreateAlertRuleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(ALERT_METRICS)
  metric!: (typeof ALERT_METRICS)[number];

  @IsIn(ALERT_COMPARATORS)
  comparator!: (typeof ALERT_COMPARATORS)[number];

  @IsNumber()
  threshold!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  windowMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  cooldownMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  notifyEmails?: string[];
}

export class UpdateAlertRuleStatusDto {
  @IsIn(['ACTIVE', 'PAUSED'])
  status!: 'ACTIVE' | 'PAUSED';
}

export class UpdateAlertEventStatusDto {
  @IsIn(['ACKNOWLEDGED', 'RESOLVED'])
  status!: 'ACKNOWLEDGED' | 'RESOLVED';
}
