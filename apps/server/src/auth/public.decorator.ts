import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'carelog:isPublic';

/**
 * 인증 없이 접근할 수 있는 라우트에만 붙인다.
 * JwtAuthGuard가 전역으로 걸려 있으므로(M4-06), 이 데코레이터가 없는 라우트는 모두 인증이 필요하다.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
