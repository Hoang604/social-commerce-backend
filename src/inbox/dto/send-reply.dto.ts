import { IsNotEmpty, IsString } from 'class-validator';

export class SendReplyDto {
  @IsNotEmpty()
  @IsString()
  text: string;
}
