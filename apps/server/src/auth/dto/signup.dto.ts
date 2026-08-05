import { IsString, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
