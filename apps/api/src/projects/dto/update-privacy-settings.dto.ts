import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdatePrivacySettingsDto {
  @IsOptional()
  @IsBoolean()
  disableRawPayloadStorage?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sensitiveFieldMasks?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number | null;
}
