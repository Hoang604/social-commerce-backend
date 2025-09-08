import { IsNotEmpty, IsString } from 'class-validator';

export class SendReplyDto {
  @IsNotEmpty()
  @IsString()
  text: string;

  @IsNotEmpty()
  @IsString()
  visitorId: string; // Thêm visitorId để biết người nhận
}
