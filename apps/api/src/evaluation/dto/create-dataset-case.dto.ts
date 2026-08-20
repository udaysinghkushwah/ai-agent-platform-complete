import { ArrayMinSize, IsArray, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DatasetCaseInput {
  @IsString()
  @MaxLength(200)
  caseKey!: string;

  @IsObject()
  input!: Record<string, unknown>;

  @IsOptional()
  expectedOutput?: unknown;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class CreateDatasetCasesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DatasetCaseInput)
  cases!: DatasetCaseInput[];
}
