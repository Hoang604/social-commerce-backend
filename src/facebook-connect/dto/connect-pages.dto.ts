import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

/**
 * Defines the structure for a single page to be connected.
 * This class is used for validation within the ConnectPagesDto.
 */
class PageToConnectDto {
  @IsString()
  @IsNotEmpty()
  facebookPageId: string;

  @IsString()
  @IsNotEmpty()
  pageName: string;
}

/**
 * The main DTO for the batch connection endpoint.
 * It expects an array of page objects.
 */
export class ConnectPagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageToConnectDto)
  pages: PageToConnectDto[];
}
