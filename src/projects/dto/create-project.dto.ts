import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsUrl()
  siteUrl?: string;
}
