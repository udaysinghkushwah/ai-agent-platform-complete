import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const PROJECT_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type ProjectEnvironment = (typeof PROJECT_ENVIRONMENTS)[number];

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsIn(PROJECT_ENVIRONMENTS)
  environment?: ProjectEnvironment;
}
