import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const SLOTS = ['MORNING', 'NOON', 'EVENING'] as const;

/** "HH:mm" 24시간 형식 */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateScheduleDto {
  @IsString()
  elderId: string;

  @IsIn(SLOTS)
  slot: (typeof SLOTS)[number];

  @Matches(TIME_PATTERN, { message: 'time은 "HH:mm" 형식이어야 합니다.' })
  time: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
