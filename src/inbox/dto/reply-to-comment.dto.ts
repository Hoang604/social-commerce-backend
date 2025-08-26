import { IsString, IsNotEmpty } from 'class-validator';

export class ReplyToCommentDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
