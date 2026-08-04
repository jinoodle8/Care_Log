import type { Decision, LogStats } from './log';

/** 로그의 판정 목록으로부터 일/주 이행률 통계를 계산한다.
 * M2 단계에서는 스케줄 CRUD(M3-01)가 아직 없으므로, 조회된 로그 건수 자체를
 * scheduledCount로 취급한다(어르신 모드는 시도할 때마다 TAKEN/UNCERTAIN/MISSED
 * 로그를 하나씩 남기므로, 로그 건수 = 시도 건수와 같다). */
export function calculateLogStats(decisions: Decision[], range: LogStats['range']): LogStats {
  const takenCount = decisions.filter((decision) => decision === 'TAKEN').length;
  const uncertainCount = decisions.filter((decision) => decision === 'UNCERTAIN').length;
  const missedCount = decisions.filter((decision) => decision === 'MISSED').length;
  const scheduledCount = decisions.length;
  const adherenceRate = scheduledCount === 0 ? 0 : takenCount / scheduledCount;

  return { range, takenCount, uncertainCount, missedCount, scheduledCount, adherenceRate };
}
