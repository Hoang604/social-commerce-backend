import {
  IsNotEmpty,
  IsString,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsNotSameAsCurrentPassword', async: false })
export class IsNotSameAsCurrentPassword
  implements ValidatorConstraintInterface
{
  validate(newPassword: string, args: ValidationArguments) {
    const object = args.object as any;
    return newPassword !== object.currentPassword;
  }
}
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu hiện tại phải có ít nhất 8 ký tự.' })
  readonly currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' })
  @Validate(IsNotSameAsCurrentPassword, {
    message: 'Mật khẩu mới không thể giống mật khẩu hiện tại.',
  })
  readonly newPassword: string;
}
