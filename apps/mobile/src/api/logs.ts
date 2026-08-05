import type { CreateLogRequest, MedicationLog } from '@carelog/shared';
import { apiClient } from './client';

/** elderId는 서버가 인증 토큰에서 유도하므로 본문에 담지 않는다. */
export type UploadLogPayload = CreateLogRequest;

export async function uploadLog(payload: UploadLogPayload): Promise<MedicationLog> {
  const response = await apiClient.post<MedicationLog>('/logs', payload);
  return response.data;
}
