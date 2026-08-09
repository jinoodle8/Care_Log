# CareLog

스마트폰 카메라와 비전 AI로 어르신의 복약 '행동'을 인식·기록하고, 보호자(자녀)에게
실시간으로 증명하는 플랫폼. 개발 원칙과 전체 사양은 [CLAUDE.md](CLAUDE.md), 요구사항/설계/
태스크는 [docs/PRD.md](docs/PRD.md), [docs/TRD.md](docs/TRD.md), [docs/TASKS.md](docs/TASKS.md)를 참고한다.

## 구조

```
carelog/
├── apps/
│   ├── mobile/     # Expo(React Native + TypeScript) 앱 — 어르신/보호자 모드
│   └── server/      # NestJS + Prisma + PostgreSQL 백엔드
├── packages/
│   └── shared/       # 공유 타입·상수 (RecognitionEngine, 판정 정책 등)
└── ai/                 # M5~ 실모델 학습/추출 스크립트 (M1~M4는 비어있음)
```

## 사전 준비물

- Node.js 20+
- pnpm (`npm install -g pnpm` 또는 `corepack enable`)
- Docker Desktop (로컬 PostgreSQL 컨테이너 실행용)
- Expo Go 앱 (실기기 테스트, 선택) 또는 웹 브라우저

## 최초 설정

```bash
git clone https://github.com/jinoodle8/Care_Log.git
cd Care_Log
pnpm install
```

`apps/server/.env.example`을 `apps/server/.env`로 복사하고 필요 시 값을 수정한다 (기본값은 로컬 Docker Postgres 기준으로 바로 동작).

```bash
cp apps/server/.env.example apps/server/.env
```

## 로컬 인프라 실행 (PostgreSQL + MinIO)

```bash
docker compose up -d
```

- `postgres` — 로그·계정 DB (5432)
- `minio` — S3 대체 스토리지 (API 9000, 콘솔 http://localhost:9001, 계정 `carelog` / `carelog-secret`)
- `minio-init` — `carelog-vault` 버킷을 생성하고 퍼블릭 차단·SSE(AES-256)·30일 라이프사이클을 적용한 뒤 종료한다

버킷 정책만 다시 적용하려면:

```bash
docker compose up minio-init --force-recreate
```

최초 1회 마이그레이션:

```bash
pnpm --filter @carelog/server prisma:migrate
```

## 앱 실행

### 서버 (NestJS)

```bash
pnpm --filter @carelog/server start:dev
```

- 기본 포트: `http://localhost:3000`
- Prisma Studio(DB GUI): `pnpm --filter @carelog/server prisma:studio`

### 모바일 (Expo)

```bash
pnpm --filter @carelog/mobile start
```

- 터미널 QR코드를 Expo Go 앱으로 스캔하거나, `w`를 눌러 웹으로 실행한다.
- AI 인식은 M1~M4 구간에서 항상 `MockRecognitionEngine`을 사용한다. 실모델 라이브러리는
  M5 이전까지 설치하지 않는다 (CLAUDE.md 0장 원칙).

### shared 패키지 변경 시

`packages/shared`를 수정한 뒤에는 빌드가 필요하다 (mobile/server가 `dist/`를 참조):

```bash
pnpm --filter @carelog/shared build
```

## 공통 스크립트 (루트에서 실행)

```bash
pnpm lint     # 전체 워크스페이스 lint
pnpm build    # 전체 워크스페이스 build
pnpm test     # 전체 워크스페이스 test
```

## 개발 워크플로

1. `docs/TASKS.md`의 체크박스 단위(태스크 1개 = 커밋 1개)로 진행한다.
2. 커밋 메시지는 `feat|fix|chore(scope): 내용` 형식을 따른다.
3. 각 태스크 완료 기준(DoD)은 `docs/TASKS.md` 상단 참고: 타입 에러 0, lint 통과,
   핵심 로직 단위 테스트, 실기기(Expo)에서 동작 확인, TASKS.md 체크 갱신.
