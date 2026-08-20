import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePromptDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class CreatePromptVersionDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateAgentVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  agentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  version!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export const VERSION_STATUSES = ['CANDIDATE', 'APPROVED', 'ARCHIVED'] as const;

export class UpdateVersionStatusDto {
  @IsIn(VERSION_STATUSES)
  status!: (typeof VERSION_STATUSES)[number];
}
