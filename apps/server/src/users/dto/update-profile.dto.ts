import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 이름·전화번호 중 보낸 항목만 바꾼다. 둘 다 없으면 서비스에서 거부한다. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone?: string;
}
