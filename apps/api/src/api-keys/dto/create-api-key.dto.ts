import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsArray()
  scopes?: string[];
}
