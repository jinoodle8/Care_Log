# CareLog TRD (기술 요구사항 문서)

> 본 문서는 `CLAUDE.md` 2장(기술 스택)·4장(AI 모듈 인터페이스)·5장(MVP 기능 범위/API/DB)을 기반으로
> 모듈 설계, 폴더 구조, 에러 처리, 환경변수 목록을 정의한다. `docs/PRD.md` 승인을 전제로 한다.

---

## 1. 기술 스택 (고정, 변경 금지)

| 레이어 | 기술 | 비고 |
|---|---|---|
| 모바일 앱 | React Native + Expo (TypeScript) | 어르신/보호자 모드를 하나의 앱에서 역할 분기. EAS Build |
| 카메라·추론 | `react-native-vision-camera` + frame processor | 실모델 단계(M5~)에서 `react-native-fast-tflite` 온디바이스 추론 |
| 백엔드 | Node.js + NestJS (TypeScript) | REST + WebSocket(Nest Gateway, Socket.IO 어댑터) |
| DB | PostgreSQL + Prisma | 로그·계정·연동 관계 저장 |
| 스토리지 | AWS S3 (로컬 개발은 MinIO) | 영상 원본만. SSE-S3/KMS AES-256, 기본 30일 라이프사이클 |
| 실시간 알림 | WebSocket + Expo Push Notification | 복약 완료/미복용/수동확인 요청 |
| 인증 | JWT (Access+Refresh) | 어르신-보호자 초대코드 연동, 어르신 온보딩은 보호자 대리 세팅 |
| AI (M5~) | YOLOv8n INT8 → TFLite, CNN-BiLSTM | 학습은 Python(Ultralytics/PyTorch), 앱엔 `.tflite`만 탑재 |

**M1~M4 구간에는 vision-camera의 프레임 프로세서/실모델 관련 라이브러리(`react-native-fast-tflite` 등)를 설치하지 않는다.** 카메라 자체(녹화)는 `expo-camera` 또는 `react-native-vision-camera`의 기본 녹화 기능만 사용하고, 프레임 분석은 전량 `MockRecognitionEngine`이 담당한다.

## 2. 저장소 구조 (모노레포)

```
carelog/
├── CLAUDE.md
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   └── TASKS.md
├── apps/
│   ├── mobile/                 # Expo RN 앱
│   │   ├── app/                 # expo-router 화면 (elder/, guardian/, onboarding/)
│   │   ├── src/
│   │   │   ├── features/        # elder-capture, guardian-dashboard, schedule, auth ...
│   │   │   ├── recognition/     # RecognitionEngine, MockRecognitionEngine, (M5~) TFLiteRecognitionEngine
│   │   │   ├── api/              # REST/WS 클라이언트 (packages/shared 타입 사용)
│   │   │   ├── store/             # 전역 상태 (Zustand 등)
│   │   │   └── components/
│   │   ├── app.json / eas.json
│   │   └── package.json
│   └── server/                  # NestJS 백엔드
│       ├── src/
│       │   ├── auth/
│       │   ├── links/            # 초대코드 연동
│       │   ├── users/
│       │   ├── logs/             # 복약 로그 CRUD + 통계
│       │   ├── schedules/        # 스케줄 CRUD + 미복용 감지 크론
│       │   ├── realtime/         # WebSocket Gateway + Expo Push 발송
│       │   ├── media/            # S3 presigned 업로드
│       │   ├── common/           # 필터/가드/인터셉터/파이프
│       │   └── prisma/
│       ├── prisma/schema.prisma
│       ├── test/
│       └── package.json
├── packages/
│   └── shared/                   # 타입·상수 공유
│       ├── src/
│       │   ├── recognition.ts     # RecognitionEngine 인터페이스 (CLAUDE.md 4장 원문)
│       │   ├── log.ts              # MedicationLog 관련 타입
│       │   ├── dto/                 # API 요청/응답 DTO 타입
│       │   └── constants.ts
│       └── package.json
└── ai/                             # M5~에서 실질적으로 채워짐
    ├── dataset/                     # git 제외, DVC 관리
    ├── training/                    # YOLOv8n·CNN-BiLSTM 학습 스크립트(Python)
    └── export/                      # .tflite 산출물
```

모노레포 관리는 `pnpm workspaces` + `turborepo`(또는 최소 구성 시 pnpm workspaces만)를 사용한다. 패키지 매니저는 `pnpm`으로 고정한다(락파일 일관성).

## 3. AI 모듈 설계 (Mock ↔ 실모델 교체 지점)

### 3.1 인터페이스 (packages/shared/src/recognition.ts, CLAUDE.md 4장 원문 그대로 사용)

```ts
export interface Detection {
  cls: 'face' | 'pill' | 'hand';
  conf: number;
  bbox: [number, number, number, number];
}

export type ActionStep = 'pick_up' | 'hand_to_mouth' | 'swallow' | 'drink_water';

export interface RecognitionResult {
  detections: Detection[];
  actionSequence: ActionStep[];
  sequenceConf: number;
  finalDecision: 'TAKEN' | 'UNCERTAIN' | 'MISSED';
}

export interface RecognitionEngine {
  analyze(session: FrameSource): Promise<RecognitionResult>;
}
```

`FrameSource`는 M1~M4 구간에서는 Mock이 소비하지 않는 최소 타입(예: `{ durationMs: number; demoMode?: boolean }`)으로 정의하고, M5에서 vision-camera 프레임 스트림 타입으로 확장한다. **인터페이스 시그니처(`analyze(session): Promise<RecognitionResult>`) 자체는 M1부터 M6까지 변경하지 않는다** — 이것이 Mock↔실모델 교체 지점의 계약이다.

### 3.2 MockRecognitionEngine (apps/mobile/src/recognition/MockRecognitionEngine.ts)

- 생성자 옵션: `{ takenRate=0.90, uncertainRate=0.08, missedRate=0.02, demoMode=false, delayMsRange=[3000,5000] }`
- `analyze()`:
  1. `delayMsRange` 내 랜덤 지연(setTimeout)으로 분석 체감 시간 시뮬레이션
  2. `demoMode=true`이면 항상 `TAKEN`, `sequenceConf=0.98`
  3. 그 외에는 확률 테이블로 `finalDecision` 샘플링 후, 판정 정책 표(§5.1)에 맞는 `sequenceConf` 범위 내 랜덤값 생성
  4. `TAKEN`/`UNCERTAIN`이면 `actionSequence`를 `['pick_up','hand_to_mouth','swallow','drink_water']` 전체 또는 부분으로 구성(판정과 정합되게), `MISSED`면 빈 배열 또는 일부만
  5. `detections`는 화면 중앙(대략 뷰포트 40~60% 범위) 근처에 `face`/`pill`/`hand` 각 1개씩 랜덤 bbox·conf(0.85~0.99) 생성
- 데모 모드 토글은 개발자 설정 화면(또는 env/AsyncStorage 플래그)에서 제어

### 3.3 TFLiteRecognitionEngine (M5~ 스텁, M6 실구현)

- M5: `apps/mobile/src/recognition/TFLiteRecognitionEngine.ts`를 **스텁**으로 생성 — `analyze()`가 `NotImplementedError`를 던지거나 Mock에 위임. 이 시점까지 `react-native-fast-tflite` 등 실모델 라이브러리는 설치하지 않는다.
- M6: 실제 vision-camera frame processor + `.tflite` 모델 로드 후 추론 구현.
- 엔진 선택은 `apps/mobile/src/recognition/index.ts`의 팩토리 함수(`getRecognitionEngine()`)가 env/config 플래그(`RECOGNITION_ENGINE=mock|tflite`)로 결정한다.

## 4. 데이터 모델 (Prisma)

```prisma
enum Role {
  ELDER
  GUARDIAN
}

enum ScheduleSlot {
  MORNING
  NOON
  EVENING
}

enum Decision {
  TAKEN
  UNCERTAIN
  MISSED
}

model User {
  id          String   @id @default(cuid())
  role        Role
  name        String
  phone       String   @unique
  passwordHash String?  // ELDER는 보호자가 대리 로그인하므로 null 허용 검토
  pushToken   String?
  createdAt   DateTime @default(now())

  elderLinks    Link[] @relation("ElderLinks")
  guardianLinks Link[] @relation("GuardianLinks")
  schedules     Schedule[]
  logs          MedicationLog[] @relation("ElderLogs")
  manualConfirms MedicationLog[] @relation("ManualConfirmedLogs")
}

model Link {
  id         String   @id @default(cuid())
  elderId    String
  guardianId String
  elder      User     @relation("ElderLinks", fields: [elderId], references: [id])
  guardian   User     @relation("GuardianLinks", fields: [guardianId], references: [id])
  createdAt  DateTime @default(now())

  @@unique([elderId, guardianId])
}

model InviteCode {
  id         String   @id @default(cuid())
  code       String   @unique
  guardianId String
  expiresAt  DateTime
  redeemedAt DateTime?
  createdAt  DateTime @default(now())
}

model Schedule {
  id      String       @id @default(cuid())
  elderId String
  elder   User         @relation(fields: [elderId], references: [id])
  slot    ScheduleSlot
  time    String        // "HH:mm", 로컬 타임존은 서버 정책상 KST 고정(MVP)
  enabled Boolean       @default(true)

  @@unique([elderId, slot])
}

model MedicationLog {
  id                  String    @id @default(cuid())
  elderId             String
  elder               User      @relation("ElderLogs", fields: [elderId], references: [id])
  scheduleId          String?
  takenAt             DateTime
  decision            Decision
  sequenceConf        Float
  detectionsJson      Json
  actionSequenceJson  Json
  videoRef            String?    // s3://... 참조만, 원본 미저장
  manualConfirmedBy   String?
  manualConfirmedByUser User?    @relation("ManualConfirmedLogs", fields: [manualConfirmedBy], references: [id])
  manualConfirmedAt   DateTime?
  deviceInfo          Json?
  createdAt           DateTime  @default(now())

  @@index([elderId, takenAt])
}
```

- `log_id` 포맷(`CL-YYYY-MMDD-HHmm-XXXX`)은 표시용 코드로 별도 필드화하지 않고 `id`(cuid)를 PK로 사용, 필요시 화면 표시용 포맷터를 `packages/shared`에 둔다.
- 영상 원본은 DB에 저장하지 않는다(`videoRef`는 S3 키/URL 참조만). (CLAUDE.md 7장)

## 5. 핵심 API 설계

### 5.1 판정 정책 (공통 상수, packages/shared/src/constants.ts)

```
TAKEN_THRESHOLD = 0.90      // sequenceConf >= 0.90 → TAKEN
UNCERTAIN_THRESHOLD = 0.60  // 0.60 <= sequenceConf < 0.90 → UNCERTAIN
                             // sequenceConf < 0.60 → MISSED
MISSED_GRACE_MINUTES = 30   // 스케줄 +30분 경과 시 미복용 의심 크론 트리거
```

### 5.2 REST API

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/auth/signup` | 보호자 회원가입 | - |
| POST | `/auth/login` | 로그인(JWT 발급) | - |
| POST | `/auth/refresh` | 토큰 재발급 | Refresh Token |
| POST | `/links/invite-code` | 보호자가 초대코드 생성(24h 만료) | JWT(Guardian) |
| POST | `/links/redeem` | 초대코드로 어르신 계정 생성+연동 | - (코드 자체가 권한) |
| GET | `/users/me` | 내 정보 | JWT |
| GET | `/users/me/elders` | 연동된 어르신 목록 | JWT(Guardian) |
| POST | `/logs` | 복약 로그 업로드(RecognitionResult 포함) | JWT(Elder) |
| GET | `/logs?elderId=&from=&to=&decision=` | 타임라인 조회 | JWT |
| GET | `/logs/stats?elderId=&range=day\|week` | 이행률 통계 | JWT(Guardian) |
| PATCH | `/logs/:id/manual-confirm` | UNCERTAIN 수동확인(`{decision, note?}`) | JWT(Guardian) |
| GET | `/logs/:id/video-url` | 판정 근거 영상 재생용 presigned GET URL | JWT |
| GET/POST/PATCH/DELETE | `/schedules` | 스케줄 CRUD | JWT(Guardian) |
| POST | `/media/presign` | 영상 업로드용 S3 presigned URL 발급 | JWT(Elder) |
| POST | `/users/me/push-token` | Expo 푸시 토큰 등록 | JWT |

### 5.3 WebSocket

- Namespace: `/realtime`
- Room: `elder:{elderId}` — 보호자가 연동된 어르신 room을 구독
- 서버 → 클라이언트 이벤트: `log.created`, `log.updated`(수동확인 반영), `schedule.missed`
- 인증: 연결 시 JWT를 handshake auth로 전달, 서버에서 검증 후 연동된 room만 join 허용

### 5.4 에러 처리 정책

- 모든 REST 에러 응답은 공통 포맷: `{ statusCode, code, message, timestamp, path }` (`common/filters/http-exception.filter.ts`에서 통일)
- 도메인 에러 코드 예시: `INVITE_CODE_EXPIRED`, `INVITE_CODE_INVALID`, `LOG_NOT_FOUND`, `NOT_LINKED_ELDER`, `SCHEDULE_SLOT_DUPLICATE`
- 인증 실패: 401(`UNAUTHORIZED`), 권한 없음(연동 안 된 어르신 접근 등): 403(`FORBIDDEN`)
- 입력 검증: `class-validator` 기반 DTO 검증, 실패 시 400 + 필드별 메시지
- WebSocket: 인증 실패 시 연결 거부(`disconnect`), room 접근 권한 없음은 이벤트 무시 + 서버 로그
- 모바일 앱: API 클라이언트는 공통 axios 인터셉터로 401 시 토큰 재발급 1회 재시도 후 실패 시 로그아웃 처리. 네트워크 오류는 화면별 재시도 UI(§PRD 4.2.3)로 노출
- 크론(미복용 감지) 실패는 알림 발송 실패를 삼키지 않고 로깅 + 다음 주기 재시도(중복 발송 방지를 위해 `MedicationLog` 부재 여부로 멱등 처리)

## 6. 환경변수 목록

### 6.1 apps/server (.env)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/carelog
JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=30d
INVITE_CODE_EXPIRES_HOURS=24
MISSED_GRACE_MINUTES=30

# S3 / MinIO (M4~)
S3_ENDPOINT=            # MinIO 사용 시 로컬 엔드포인트, AWS는 빈 값
S3_REGION=ap-northeast-2
S3_BUCKET=carelog-vault
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PRESIGN_EXPIRES_SECONDS=300
S3_OBJECT_LIFECYCLE_DAYS=30

# Expo Push (M3~)
EXPO_ACCESS_TOKEN=
```

### 6.2 apps/mobile (.env / app.config.ts extra)

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000
EXPO_PUBLIC_RECOGNITION_ENGINE=mock       # mock | tflite (M5~에서 tflite 허용)
EXPO_PUBLIC_MOCK_TAKEN_RATE=0.90
EXPO_PUBLIC_MOCK_UNCERTAIN_RATE=0.08
EXPO_PUBLIC_MOCK_MISSED_RATE=0.02
EXPO_PUBLIC_DEMO_MODE=false
```

- 시크릿(비밀키류)은 `EXPO_PUBLIC_` 접두사를 절대 사용하지 않는다(클라이언트 번들에 노출되므로 API Base URL 등 공개 가능한 값만 허용).
- `.env.example`을 각 앱에 커밋하고 실제 `.env`는 `.gitignore` 처리.

## 7. 모듈 간 의존 관계 요약

```
packages/shared  ──(타입/상수)──▶  apps/mobile
                 ──(타입/상수)──▶  apps/server

apps/mobile/src/recognition (RecognitionEngine)
   MockRecognitionEngine  (M2~, 기본)
   TFLiteRecognitionEngine (M5 스텁 → M6 구현)

apps/server
   auth → links → users
   logs ← recognition 결과 업로드 (mobile이 분석 후 결과만 전송, 서버는 재분석하지 않음)
   schedules → realtime(크론 트리거) → Expo Push
   media → S3 presigned (업로드 자체는 클라이언트가 S3로 직접 PUT)
```

## 8. 테스트 전략 (요약, 태스크별 상세는 TASKS.md)

- 서버: Jest 유닛 테스트(서비스 로직: 판정 정책, 초대코드 만료, 이행률 계산) + 주요 API e2e 테스트(supertest)
- 모바일: `MockRecognitionEngine` 확률 분포·판정 정책 유닛 테스트, 화면 단위는 실기기/Expo Go 수동 확인(CLAUDE.md 6장 DoD)
- 공통: `packages/shared`의 판정 정책 함수는 서버/모바일 양쪽에서 동일 로직을 import하여 중복 구현 방지
