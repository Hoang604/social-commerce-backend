import { IsString, IsOptional, IsUrl, IsObject } from 'class-validator';

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
}
