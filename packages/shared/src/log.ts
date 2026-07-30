import type { ActionStep, Detection } from './recognition';

export type Role = 'ELDER' | 'GUARDIAN';
export type ScheduleSlot = 'MORNING' | 'NOON' | 'EVENING';
export type Decision = 'TAKEN' | 'UNCERTAIN' | 'MISSED';

export interface MedicationLog {
  id: string;
  elderId: string;
  scheduleId?: string | null;
  takenAt: string; // ISO 8601
  decision: Decision;
  sequenceConf: number;
  detections: Detection[];
  actionSequence: ActionStep[];
  videoRef?: string | null;
  manualConfirmedBy?: string | null;
  manualConfirmedAt?: string | null;
  deviceInfo?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Schedule {
  id: string;
  elderId: string;
  slot: ScheduleSlot;
  time: string; // "HH:mm"
  enabled: boolean;
}

export interface CreateLogRequest {
  scheduleId?: string;
  takenAt: string;
  decision: Decision;
  sequenceConf: number;
  detections: Detection[];
  actionSequence: ActionStep[];
  videoRef?: string;
  deviceInfo?: Record<string, unknown>;
}

export interface ManualConfirmRequest {
  decision: Extract<Decision, 'TAKEN' | 'MISSED'>;
  note?: string;
}

export interface LogStats {
  range: 'day' | 'week';
  takenCount: number;
  uncertainCount: number;
  missedCount: number;
  scheduledCount: number;
  adherenceRate: number; // takenCount / scheduledCount
}
