import { apiClient } from './client';

export type VideoContentType = 'video/mp4' | 'video/quicktime';

export interface PresignUploadResponse {
  /** 이 URL로 클라이언트가 직접 PUT 한다. 영상 바이트는 서버를 거치지 않는다. */
  uploadUrl: string;
  /** 업로드 성공 후 POST /logs의 videoRef로 그대로 넘긴다. */
  videoRef: string;
  /** 서명에 포함된 헤더. 하나라도 빠지면 S3가 403을 준다. */
  requiredHeaders: Record<string, string>;
  expiresInSeconds: number;
}

export async function presignVideoUpload(params: {
  contentType: VideoContentType;
  sizeBytes?: number;
}): Promise<PresignUploadResponse> {
  const response = await apiClient.post<PresignUploadResponse>(
    '/media/presign',
    params,
  );
  return response.data;
}
