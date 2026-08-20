import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EVALUATOR_TYPES } from '../evaluator-config.types';

// class-validator needs concrete classes per evaluator shape rather than a
// bare union, so each evaluator type gets a small DTO and the array is
// validated loosely at this layer — the worker re-validates the discriminant
// before running anything (never trust a queued job blindly either).
export class EvaluatorConfigDto {
  @IsIn(EVALUATOR_TYPES)
  type!: (typeof EVALUATOR_TYPES)[number];

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  field?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedTools?: string[];

  @IsOptional()
  @IsString()
  rubric?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  k?: number; // RECALL_AT_K
}

export class CaseOutputDto {
  @IsString()
  caseKey!: string;

  @IsOptional()
  output?: unknown;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // Optional customer-reported cost (USD) for producing this case's output.
  // Powers the regression policy's cost-spike check — entirely optional,
  // regression checks just skip cost comparison if it's never provided.
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}

export class CreateEvaluationRunDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  agentVersion?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvaluatorConfigDto)
  evaluators!: EvaluatorConfigDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CaseOutputDto)
  outputs!: CaseOutputDto[];
}
