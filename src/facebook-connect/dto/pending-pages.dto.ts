import { IsArray, IsString } from 'class-validator';

class FacebookPageDto {
  @IsString()
  id: string;

  @IsString()
  name: string;
}

export class PendingPagesDto {
  @IsArray()
  pages: FacebookPageDto[];
}
