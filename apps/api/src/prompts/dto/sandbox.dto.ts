import { IsNotEmpty, IsOptional, IsString, IsNumber, IsObject } from 'class-validator';

export class ExecuteSandboxPromptDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @IsOptional()
  maxTokens?: number;

  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;
}
