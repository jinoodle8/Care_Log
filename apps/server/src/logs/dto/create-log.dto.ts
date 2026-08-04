import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const DETECTION_CLASSES = ['face', 'pill', 'hand'] as const;
const ACTION_STEPS = [
  'pick_up',
  'hand_to_mouth',
  'swallow',
  'drink_water',
] as const;
const DECISIONS = ['TAKEN', 'UNCERTAIN', 'MISSED'] as const;

export class DetectionDto {
  @IsIn(DETECTION_CLASSES)
  cls: (typeof DETECTION_CLASSES)[number];

  @IsNumber()
  @Min(0)
  @Max(1)
  conf: number;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsNumber({}, { each: true })
  bbox: [number, number, number, number];
}

export class CreateLogDto {
  // TODO(M2-15): JWT 가드 도입 후 req.user.id에서 유도하고 이 필드는 제거한다.
  @IsString()
  elderId: string;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsISO8601()
  takenAt: string;

  @IsIn(DECISIONS)
  decision: (typeof DECISIONS)[number];

  @IsNumber()
  @Min(0)
  @Max(1)
  sequenceConf: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetectionDto)
  detections: DetectionDto[];

  @IsArray()
  @IsIn(ACTION_STEPS, { each: true })
  actionSequence: (typeof ACTION_STEPS)[number][];

  @IsOptional()
  @IsString()
  videoRef?: string;

  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}
