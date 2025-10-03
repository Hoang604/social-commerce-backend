import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUrl,
  ArrayMinSize,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  whitelistedDomains: string[];
}
