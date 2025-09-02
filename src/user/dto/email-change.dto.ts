import { IsEmail, IsNotEmpty } from 'class-validator';

export class EmailChangeDto {
  @IsNotEmpty({ message: 'Email mới không được để trống.' })
  @IsEmail()
  newEmail: string;

  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống.' })
  password: string;
}
