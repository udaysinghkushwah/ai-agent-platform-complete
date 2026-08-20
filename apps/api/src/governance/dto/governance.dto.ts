import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const ACTIVE_STATUSES = ['ACTIVE', 'PAUSED'] as const;

export class CreateGovernancePolicyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTools?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedTools?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requireApprovalTools?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restrictedEnvironments?: string[];

  @IsOptional()
  @IsObject()
  maxParameterValues?: Record<string, Record<string, number>>;
}

export class UpdatePolicyStatusDto {
  @IsIn(ACTIVE_STATUSES)
  status!: (typeof ACTIVE_STATUSES)[number];
}

export class PolicyCheckDto {
  @IsString()
  toolName!: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}
