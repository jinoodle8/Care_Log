import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedeemInviteCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  elderName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  elderPhone: string;
}
