import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConnectedPageDto {
  @IsString()
  @IsNotEmpty()
  facebookPageId: string;

  @IsString()
  @IsNotEmpty()
  pageName: string;
}
