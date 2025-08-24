import { IsUrl } from 'class-validator';

export class AuthUrlDto {
  @IsUrl()
  authUrl: string;
}
