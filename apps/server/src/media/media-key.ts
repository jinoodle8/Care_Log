import { randomBytes } from 'node:crypto';

/** 업로드를 허용할 영상 MIME 타입. 임의 파일 업로드 통로가 되지 않도록 화이트리스트로 제한한다. */
export const ALLOWED_VIDEO_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime',
] as const;

export type AllowedVideoContentType =
  (typeof ALLOWED_VIDEO_CONTENT_TYPES)[number];

const EXTENSION_BY_CONTENT_TYPE: Record<AllowedVideoContentType, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * CLAUDE.md 4장의 `s3://carelog-vault/2026/06/12/xxx` 형식을 따르는 오브젝트 키를 만든다.
 * 날짜 프리픽스는 라이프사이클·감사 추적에 쓰이고, 파일명은 추측 불가능한 랜덤 값이라
 * 키를 알아도 다른 어르신의 영상 키를 유추할 수 없다.
 */
export function buildVideoKey(
  contentType: AllowedVideoContentType,
  now: Date = new Date(),
): string {
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const name = randomBytes(16).toString('hex');
  return `${year}/${month}/${day}/${name}.${EXTENSION_BY_CONTENT_TYPE[contentType]}`;
}

/** DB에는 원본이 아니라 이 참조 문자열만 저장한다(CLAUDE.md 7장). */
export function toVideoRef(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

/** `s3://bucket/key`를 되돌린다. 형식이 다르면 null. */
export function parseVideoRef(
  videoRef: string,
): { bucket: string; key: string } | null {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(videoRef);
  if (!match) return null;
  return { bucket: match[1], key: match[2] };
}
