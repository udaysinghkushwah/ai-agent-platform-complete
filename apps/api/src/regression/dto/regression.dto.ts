import { ArrayUnique, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { EVALUATOR_TYPES } from '../../evaluation/evaluator-config.types';

export class CreateRegressionPolicyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(EVALUATOR_TYPES, { each: true })
  criticalEvaluators?: (typeof EVALUATOR_TYPES)[number][];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  maxPassRateDrop?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  warnPassRateDrop?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCostIncreasePct?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateRegressionCheckDto {
  @IsString()
  baselineRunId!: string;

  @IsString()
  candidateRunId!: string;

  @IsOptional()
  @IsString()
  policyId?: string;
}
