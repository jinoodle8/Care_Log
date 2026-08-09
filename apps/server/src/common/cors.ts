import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * 운영에서는 허용 origin을 화이트리스트로 제한한다(M4-08).
 * 개발에서는 Expo 웹 dev 서버 포트가 매번 바뀌므로 모두 허용한다.
 */
export function buildCorsOptions(
  nodeEnv: string | undefined,
  allowedOrigins: string | undefined,
): CorsOptions {
  const origins = parseOrigins(allowedOrigins);

  if (nodeEnv === 'production') {
    if (origins.length === 0) {
      throw new Error(
        'production 환경에서는 CORS_ALLOWED_ORIGINS를 반드시 설정해야 합니다.',
      );
    }
    return { origin: origins, credentials: true };
  }

  // 개발/테스트: 명시된 화이트리스트가 있으면 존중하고, 없으면 전체 허용.
  return { origin: origins.length > 0 ? origins : true, credentials: true };
}

export function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
