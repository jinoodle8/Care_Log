import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** 보호자는 UNCERTAIN 건을 복약 확인(TAKEN) 또는 미복용(MISSED)으로만 정리할 수 있다. */
const MANUAL_DECISIONS = ['TAKEN', 'MISSED'] as const;

export class ManualConfirmDto {
  @IsIn(MANUAL_DECISIONS)
  decision: (typeof MANUAL_DECISIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
