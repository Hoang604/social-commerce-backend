import { IsString, IsNotEmpty, Length } from 'class-validator';

export class TurnOn2faDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
