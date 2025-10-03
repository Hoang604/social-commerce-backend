import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsUrl,
  ArrayMinSize,
} from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  widgetSettings?: object;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  whitelistedDomains?: string[];
}
