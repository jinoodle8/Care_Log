import type { CreateLogRequest, Decision, LogStats, MedicationLog } from '@carelog/shared';
import { apiClient } from './client';

/** elderId는 서버가 인증 토큰에서 유도하므로 본문에 담지 않는다. */
export type UploadLogPayload = CreateLogRequest;

export async function uploadLog(payload: UploadLogPayload): Promise<MedicationLog> {
  const response = await apiClient.post<MedicationLog>('/logs', payload);
  return response.data;
}

export async function fetchLogs(params: {
  elderId: string;
  from?: string;
  to?: string;
  decision?: Decision;
}): Promise<MedicationLog[]> {
  const response = await apiClient.get<MedicationLog[]>('/logs', { params });
  return response.data;
}

export async function fetchLogStats(params: {
  elderId: string;
  range: LogStats['range'];
}): Promise<LogStats> {
  const response = await apiClient.get<LogStats>('/logs/stats', { params });
  return response.data;
}

/** UNCERTAIN 건을 복약 확인(TAKEN) 또는 미복용(MISSED)으로 정리한다. */
export async function manualConfirmLog(
  logId: string,
  params: { decision: 'TAKEN' | 'MISSED'; note?: string },
): Promise<MedicationLog> {
  const response = await apiClient.patch<MedicationLog>(
    `/logs/${logId}/manual-confirm`,
    params,
  );
  return response.data;
}
