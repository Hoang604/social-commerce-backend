import {
  IsString,
  IsOptional,
  IsUrl,
  IsObject,
  IsArray,
} from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  siteUrl?: string;

  @IsOptional()
  @IsObject()
  widgetSettings?: object;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whitelistedDomains?: string[];
}
