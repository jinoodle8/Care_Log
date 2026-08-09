import { Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerStorage,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';

/** 일반 API의 기본 상한. 사람이 쓰는 앱 기준으로는 충분히 여유 있다. */
export const DEFAULT_THROTTLE_LIMIT = 120;
export const DEFAULT_THROTTLE_TTL_MS = 60_000;

/**
 * 자격 증명을 추측할 수 있는 라우트의 상한(로그인, 초대코드 사용).
 * 라우트에 @Throttle({ strict: ... })로 붙인다.
 */
export const STRICT_THROTTLE_LIMIT = 10;

/**
 * 비밀번호·초대코드 추측을 막아야 하는 라우트에 @Throttle(STRICT_THROTTLE)로 붙인다.
 * 키가 'default'인 이유는 전역 default 스로틀러의 상한을 이 라우트에서만 덮어쓰기 위해서다.
 */
export const STRICT_THROTTLE = {
  default: { ttl: DEFAULT_THROTTLE_TTL_MS, limit: STRICT_THROTTLE_LIMIT },
};

/**
 * 전역에는 default 하나만 등록한다. 여기에 이름을 더 추가하면 등록된 모든 스로틀러가
 * 모든 라우트에 함께 적용되어 가장 낮은 상한이 전체를 지배한다.
 * 라우트별 강화는 @Throttle(STRICT_THROTTLE)로 default를 덮어쓰는 방식으로 한다.
 */
export const throttlerOptions: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'default',
      ttl: DEFAULT_THROTTLE_TTL_MS,
      limit: DEFAULT_THROTTLE_LIMIT,
    },
  ],
};

/**
 * e2e 테스트는 여러 스펙이 같은 IP에서 병렬로 요청을 쏟아내므로 제한을 끈다.
 * 운영·개발 동작은 그대로 둔다.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected shouldSkip(): Promise<boolean> {
    return Promise.resolve(this.config.get<string>('NODE_ENV') === 'test');
  }
}

/**
 * AppModule의 imports 맨 앞에 둔다. 전역 가드는 등록 순서대로 실행되므로,
 * 이 모듈이 AuthModule보다 먼저 등록되어야 인증 실패 요청까지 제한 대상이 된다.
 */
@Module({
  imports: [ThrottlerModule.forRoot(throttlerOptions)],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppThrottlerModule {}
