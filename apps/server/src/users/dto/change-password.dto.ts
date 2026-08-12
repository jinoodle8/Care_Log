import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;

  // bcrypt는 72바이트를 넘는 입력을 잘라내므로 상한을 맞춰 둔다(가입과 동일).
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
