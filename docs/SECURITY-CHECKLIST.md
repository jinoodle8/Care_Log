# 보안 점검 체크리스트 (M4-08)

> 점검일: 2026-08-10 / 대상 커밋: M4-07(`716e50b`) 시점의 `master`
> 이 문서는 M4 종료 시점의 상태를 기록한 것이다. 배포 전 재점검이 필요하다.

---

## 1. 인증·인가

| 항목 | 상태 | 근거 |
|---|---|---|
| 인증 기본값이 "필요함"(fail-closed) | ✅ | `JwtAuthGuard`를 `APP_GUARD`로 전역 등록(M4-06) |
| 공개 라우트가 최소한으로 제한됨 | ✅ | `@Public()` 5곳: `GET /`, signup, login, refresh, redeem |
| 역할 분리(ELDER/GUARDIAN) | ✅ | `@Roles()` + `RolesGuard` |
| 권한 에러 코드 일관성 | ✅ | `FORBIDDEN` / `NOT_LINKED_ELDER`로 통일 |
| WebSocket 인증 | ✅ | handshake `auth.token` 검증 후 연동된 room만 join |
| 체크리스트 자동 검증 | ✅ | `test/guards.e2e-spec.ts` 20건 |

**M4-06에서 발견·수정한 취약점**: `POST /links/invite-code`에 역할 검사가 없어
어르신 토큰으로도 초대코드를 발급할 수 있었다.

## 2. CORS

| 항목 | 상태 | 근거 |
|---|---|---|
| production에서 origin 화이트리스트 강제 | ✅ | `buildCorsOptions()` — 미설정 시 부팅 실패 |
| 개발 환경 편의 유지 | ✅ | Expo dev 서버 포트 변동 대응을 위해 전체 허용 |

실행 확인:

- `NODE_ENV=production` + `CORS_ALLOWED_ORIGINS` 미설정 → 부팅 거부(exit 255)
- `CORS_ALLOWED_ORIGINS=https://app.carelog.kr` → 해당 origin만 `Access-Control-Allow-Origin` 응답,
  `http://evil.example.com`에는 헤더 미부여

## 3. Rate limiting

| 라우트 | 상한 | 실측 |
|---|---|---|
| 기본(전체) | 120회 / 60초 | 121번째 요청부터 429 |
| `POST /auth/login` | 10회 / 60초 | 11번째부터 429 |
| `POST /links/redeem` | 10회 / 60초 | 11번째부터 429 |

- 스로틀러 가드는 인증 가드보다 먼저 등록되어(`AppThrottlerModule`을 imports 최상단)
  인증 실패 요청도 제한 대상이다.
- `NODE_ENV=test`에서는 비활성. e2e 스펙들이 같은 IP에서 병렬로 요청하기 때문이다.

**점검 중 발견·수정**: 명명된 스로틀러를 둘 등록하면 모든 라우트에 둘 다 적용되어
가장 낮은 상한(10)이 전체를 지배했다. 전역에는 `default` 하나만 두고 라우트별로
`@Throttle`이 덮어쓰도록 수정했다.

## 4. 시크릿 관리

| 항목 | 상태 | 근거 |
|---|---|---|
| `EXPO_PUBLIC_` 접두사 오남용 | ✅ 없음 | 사용 중인 7개 모두 공개 가능 값(API/WS URL, 엔진 선택, mock 확률, 데모 토글) |
| 서버 시크릿이 클라이언트 번들에 포함 | ✅ 없음 | JWT 시크릿·S3 키·Expo 액세스 토큰은 서버 `.env`에만 존재 |
| `.env` 커밋 여부 | ✅ 제외됨 | `.gitignore` 처리, `.env.example`만 커밋 |
| 로컬 MinIO KMS 키가 compose에 평문 | ⚠️ 의도적 | 로컬 개발 전용이며 운영은 AWS 관리형 SSE 사용. 재사용 금지 |

## 5. 데이터 보호

| 항목 | 상태 | 근거 |
|---|---|---|
| 영상 원본 DB 미저장 | ✅ | `videoRef`(`s3://...`)만 저장, e2e로 검증 |
| 버킷 퍼블릭 접근 차단 | ✅ | `mc anonymous set none`, 서명 없는 GET 거부를 e2e로 확인 |
| 저장 시 암호화 | ✅ | SSE-S3(AES-256) 버킷 기본값 + 요청 헤더 명시 |
| 보존 기간 제한 | ✅ | 30일 라이프사이클, `mc stat`으로 만료일 확인 |
| 개인정보 평문 로깅 금지 | ✅ | `maskAuditDetail()` — 전화번호/이름 마스킹, 토큰·서명 URL 제거 |
| 입력 검증 | ✅ | 전역 `ValidationPipe`(`whitelist`, `forbidNonWhitelisted`) |
| 업로드 파일 종류·크기 제한 | ✅ | contentType 화이트리스트(mp4/mov), 50MB 상한 |

## 6. 의존성 취약점 (`pnpm audit --prod`)

**결과: 9건 (high 8, moderate 1) — 전부 `apps/mobile`의 Expo/Metro 빌드 툴체인 전이 의존성.
서버 런타임 경로에는 0건.**

| 패키지 | 심각도 | 경로 | 조치 |
|---|---|---|---|
| `brace-expansion` (2건) | high | expo-cli / react-native → glob → minimatch | Expo SDK 업데이트 대기 |
| `js-yaml` (2건) | high | @expo/xcpretty, babel-plugin-istanbul | 동일 |
| `image-size` (2건) | high | react-native → metro | 동일 |
| `nanoid` | high | @expo/metro-config → postcss | 동일 |
| `uuid` | moderate | @expo/config-plugins → xcode | 동일 |

모두 빌드·개발 도구 체인에 있어 앱 번들이나 서버 프로세스에 포함되지 않는다.
직접 버전을 올릴 수 없는 전이 의존성이므로 Expo SDK 업그레이드 시 함께 해소한다.

---

## 배포 전 남은 과제

이 항목들은 M4 범위 밖이며, 실제 배포를 준비할 때 처리해야 한다.

- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`을 배포 환경 시크릿 매니저로 이관(현재 `.env`)
- [ ] HTTPS 종단 및 HSTS 설정(리버스 프록시 계층)
- [ ] `helmet` 등 보안 헤더 미들웨어 도입
- [ ] rate limiting 저장소를 인메모리 → Redis로 교체(서버 다중화 시 상한이 인스턴스별로 적용됨)
- [ ] 프록시 뒤에서 클라이언트 IP를 올바로 식별하도록 `trust proxy` 설정(현재는 프록시 IP 기준으로 제한될 수 있음)
- [ ] refresh token 폐기(로그아웃·탈취 대응) 흐름
- [ ] 감사 로그 보존 기간 정책 및 접근 통제
- [ ] Expo SDK 업그레이드로 위 의존성 취약점 해소
