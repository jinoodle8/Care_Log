import type { Decision } from './log';

export const TAKEN_THRESHOLD = 0.9;
export const UNCERTAIN_THRESHOLD = 0.6;
export const MISSED_GRACE_MINUTES = 30;
export const INVITE_CODE_EXPIRES_HOURS = 24;

/** sequenceConf >= 0.90 → TAKEN, 0.60~0.90 → UNCERTAIN, < 0.60 → MISSED */
export function decideFromConf(sequenceConf: number): Decision {
  if (sequenceConf >= TAKEN_THRESHOLD) return 'TAKEN';
  if (sequenceConf >= UNCERTAIN_THRESHOLD) return 'UNCERTAIN';
  return 'MISSED';
}
