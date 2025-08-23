import { IsNotEmpty, IsString } from 'class-validator';

export class FacebookCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  state: string;
}
