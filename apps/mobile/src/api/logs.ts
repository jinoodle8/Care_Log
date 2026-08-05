import type { CreateLogRequest, MedicationLog } from '@carelog/shared';
import { apiClient } from './client';

// TODO(M2-15): elderId는 JWT 가드 도입 후 서버가 인증 토큰에서 유도하므로 이 필드는 제거한다.
export type UploadLogPayload = CreateLogRequest & { elderId: string };

export async function uploadLog(payload: UploadLogPayload): Promise<MedicationLog> {
  const response = await apiClient.post<MedicationLog>('/logs', payload);
  return response.data;
}
