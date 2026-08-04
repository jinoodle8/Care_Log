import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

const DECISIONS = ['TAKEN', 'UNCERTAIN', 'MISSED'] as const;

export class QueryLogsDto {
  @IsString()
  elderId: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(DECISIONS)
  decision?: (typeof DECISIONS)[number];
}
