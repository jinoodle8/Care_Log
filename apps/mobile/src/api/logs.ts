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
