import { IsBoolean, IsOptional, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateScheduleDto {
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'time은 "HH:mm" 형식이어야 합니다.' })
  time?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
