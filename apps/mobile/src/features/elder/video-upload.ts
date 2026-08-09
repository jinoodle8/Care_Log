import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';

import { presignVideoUpload, type VideoContentType } from '@/api/media';

/** 확장자로 MIME 타입을 고른다. iOS는 .mov, Android/웹은 .mp4로 녹화된다. */
export function contentTypeForUri(uri: string): VideoContentType {
  return /\.mov(\?|$)/i.test(uri) ? 'video/quicktime' : 'video/mp4';
}

/**
 * vision-camera의 Recorder는 `file://` 없는 파일시스템 경로를 준다(M5-02).
 * 업로드 계층(expo-file-system)은 URL을 기대하므로 여기서 한 번만 맞춘다.
 * 이미 스킴이 붙어 있으면 그대로 둔다.
 */
export function toFileUrl(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return `file://${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * 녹화 영상을 presigned URL로 S3에 직접 올리고 videoRef를 돌려준다(M4-02).
 * 영상 바이트는 우리 서버를 거치지 않으며, DB에는 이 videoRef만 저장된다(CLAUDE.md 7장).
 */
export async function uploadRecordedVideo(uri: string): Promise<string> {
  const contentType = contentTypeForUri(uri);

  if (Platform.OS === 'web') {
    // 웹에서는 녹화 결과가 blob: URL이라 파일 시스템 API를 쓸 수 없다.
    const blob = await (await fetch(uri)).blob();
    const presign = await presignVideoUpload({
      contentType,
      sizeBytes: blob.size,
    });

    const response = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: presign.requiredHeaders,
      body: blob,
    });
    if (!response.ok) {
      throw new Error(`영상 업로드 실패 (HTTP ${response.status})`);
    }
    return presign.videoRef;
  }

  const file = new File(uri);
  const presign = await presignVideoUpload({
    contentType,
    sizeBytes: file.size ?? undefined,
  });

  const result = await file.upload(presign.uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: presign.requiredHeaders,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`영상 업로드 실패 (HTTP ${result.status})`);
  }
  return presign.videoRef;
}
