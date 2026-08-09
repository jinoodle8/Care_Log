/**
 * 감사 로그에 남기기 전에 개인정보를 가린다(CLAUDE.md 7장 — 개인정보 평문 로깅 금지).
 * "누가 무엇을 했는가"를 추적하는 데 필요한 최소 정보만 남기는 것이 원칙이고,
 * 식별자(user id)는 그 자체로 이름·전화번호를 드러내지 않으므로 그대로 둔다.
 */

/** 값을 통째로 가려야 하는 키. 부분 노출도 허용하지 않는다. */
const REDACTED_KEYS = [
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'pushtoken',
  'code',
  'uploadurl',
  'authorization',
];

/** 마지막 4자리만 남기는 키(문의 대응 시 본인 확인용). */
const PARTIAL_KEYS = ['phone', 'elderphone'];

/** 사람 이름은 성 한 글자만 남긴다. */
const NAME_KEYS = ['name', 'eldername', 'guardianname'];

const REDACTED = '[REDACTED]';

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return REDACTED;
  return `***${phone.slice(-4)}`;
}

export function maskName(name: string): string {
  if (name.length === 0) return REDACTED;
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(name.length - 1, 1))}`;
}

/**
 * 감사 로그 detail로 넘어온 객체를 재귀적으로 마스킹한다.
 * 모르는 키는 그대로 두되, 문자열이 아닌 값(수치·불리언)은 개인정보가 아니라고 본다.
 */
export function maskAuditDetail(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskAuditDetail(item));
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();

    if (REDACTED_KEYS.includes(normalized)) {
      result[key] = REDACTED;
      continue;
    }
    if (typeof raw === 'string' && PARTIAL_KEYS.includes(normalized)) {
      result[key] = maskPhone(raw);
      continue;
    }
    if (typeof raw === 'string' && NAME_KEYS.includes(normalized)) {
      result[key] = maskName(raw);
      continue;
    }
    result[key] = maskAuditDetail(raw);
  }
  return result;
}
