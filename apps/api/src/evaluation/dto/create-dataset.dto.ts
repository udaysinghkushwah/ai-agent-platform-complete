import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDatasetDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
