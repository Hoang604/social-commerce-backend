import { IsNotEmpty, IsString } from 'class-validator';

export class SendReplyDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
