# CareLog 개발 사양서 (CLAUDE.md)

> 이 문서는 Claude Code가 CareLog를 개발할 때 항상 참조하는 최상위 사양서다.
> 사업계획서(2026.7. 모두의창업 1R)의 기술 스택·성능 목표와 일치해야 한다.

---

## 0. 개발 원칙 (반드시 준수)

1. **문서 우선(Document-First)**: 코드 작성 전 `docs/PRD.md` → `docs/TRD.md` → `docs/TASKS.md` 순서로 작성/갱신하고, TASKS의 체크박스 단위로만 구현한다.
2. **Mock-First AI**: AI 인식은 처음부터 실모델을 붙이지 않는다. `RecognitionEngine` 인터페이스를 정의하고 `MockRecognitionEngine`으로 전체 서비스 플로우를 먼저 완성한다. 실모델(TFLite)은 동일 인터페이스의 `TFLiteRecognitionEngine`으로 나중에 교체한다.
3. **작은 단위 커밋**: 태스크 1개 = 커밋 1개. 커밋 메시지는 `feat|fix|chore(scope): 내용` 형식.
4. **환경**: Windows + WSL2. 프로젝트 경로 `C:\Users\jh030\projects\carelog`. 모바일은 Expo(EAS Build), 실기기 테스트는 Expo Go + development build.
5. 모든 응답과 문서는 한국어로 작성한다. 코드 주석은 한국어 허용.

---

## 1. 프로젝트 개요

- **한 줄 정의**: 스마트폰 카메라와 비전 AI로 어르신의 복약 '행동'을 인식·기록하고, 보호자(자녀)에게 실시간으로 증명하는 플랫폼.
- **이중 페르소나**:
  - SERVICE USER — 70대 독거 어르신: 조작은 "앱 실행 1회". 실행 후 3초 카운트다운 → 자동 녹화 → 자동 판정.
  - SERVICE BUYER — 4050 직장인 자녀: 실시간 푸시 + 복약 타임라인 대시보드로 안심 확인.
- **핵심 플로우**: ① 어르신 앱 실행(3초 후 자동 녹화) → ② AI 분석(얼굴·알약·손 인식 + 복약 시퀀스 판별) → ③ 신뢰도 ≥ 0.90이면 복약 완료 로그 자동 생성(미달 시 보호자 수동확인 폴백) → ④ 보호자 앱 실시간 푸시·대시보드 반영.

---

## 2. 기술 스택 (고정)

| 레이어 | 기술 | 비고 |
|---|---|---|
| 모바일 앱 | React Native + Expo (TypeScript) | 어르신/보호자 모드를 하나의 앱에서 역할 분기. EAS Build |
| 카메라·추론 | `react-native-vision-camera` + frame processor | 실모델 단계에서 `react-native-fast-tflite`로 온디바이스 추론 |
| 백엔드 | Node.js + NestJS (TypeScript) | REST + WebSocket(Socket.IO 또는 Nest Gateway) |
| DB | PostgreSQL + Prisma | 로그·계정·연동 관계 저장 |
| 스토리지 | AWS S3 (로컬 개발은 MinIO 대체 가능) | 영상 원본. 서버측 AES-256 암호화(SSE), 기본 30일 수명주기 |
| 실시간 알림 | WebSocket + Expo Push Notification | 복약 완료/미복용 알림 |
| 인증 | JWT (어르신-보호자 초대코드 연동) | 어르신 온보딩은 보호자가 대신 세팅하는 흐름 |
| AI (실모델 단계) | YOLOv8n(3클래스: face/pill/hand) INT8 → TFLite, CNN-BiLSTM(MobileNetV3 특징 + BiLSTM 2층) | 학습은 Python(Ultralytics/PyTorch), 앱에는 .tflite만 탑재 |

**성능 목표(사업계획서 기준, 실모델 단계에서 측정)**: 객체 인식 mAP@0.5 ≥ 0.95·프레임당 ≤ 33ms(중급기), 시퀀스 분류 정확도 ≥ 95%·FPR ≤ 3%, 최종 판정 정확도 98%, 푸시 지연 ≤ 3초.

---

## 3. 저장소 구조 (모노레포)

```
carelog/
├── CLAUDE.md              # 본 문서
├── docs/
│   ├── PRD.md             # 제품 요구사항
│   ├── TRD.md             # 기술 요구사항
│   └── TASKS.md           # 체크박스 태스크 목록
├── apps/
│   ├── mobile/            # Expo RN 앱 (어르신/보호자 모드)
│   └── server/            # NestJS 백엔드
├── packages/
│   └── shared/            # 타입·상수 공유 (log 스키마 등)
└── ai/
    ├── dataset/           # 수집 영상·라벨 (git 제외, DVC 관리)
    ├── training/          # YOLOv8n·CNN-BiLSTM 학습 스크립트 (Python)
    └── export/            # .tflite 산출물
```

---

## 4. AI 모듈 인터페이스 (Mock ↔ 실모델 교체 지점)

```ts
// packages/shared/src/recognition.ts
export interface Detection {
  cls: 'face' | 'pill' | 'hand';
  conf: number;                 // 0~1
  bbox: [number, number, number, number]; // x1,y1,x2,y2
}

export type ActionStep = 'pick_up' | 'hand_to_mouth' | 'swallow' | 'drink_water';

export interface RecognitionResult {
  detections: Detection[];
  actionSequence: ActionStep[];
  sequenceConf: number;         // 0~1
  finalDecision: 'TAKEN' | 'UNCERTAIN' | 'MISSED';
}

export interface RecognitionEngine {
  /** 녹화 세션(약 10~15초) 프레임 스트림을 받아 판정 */
  analyze(session: FrameSource): Promise<RecognitionResult>;
}
```

- `MockRecognitionEngine`: 3~5초 지연 후, 설정 가능한 확률(기본 90% TAKEN / 8% UNCERTAIN / 2% MISSED)로 그럴듯한 Detection·시퀀스를 생성해 반환. Bounding Box는 화면 중앙 근처 랜덤. **데모 모드 토글**(항상 TAKEN) 포함.
- 판정 정책: `sequenceConf ≥ 0.90 → TAKEN 자동 기록`, `0.60~0.90 → UNCERTAIN(보호자 수동확인 요청)`, `< 0.60 → MISSED`.

### 복약 로그 JSON 스키마 (서버 저장 형식)

```json
{
  "log_id": "CL-2026-0612-0847-M3K9",
  "user_id": "u_58f2", "guardian_id": "g_91a7",
  "timestamp": "2026-06-12T08:47:21+09:00",
  "detections": [
    {"class": "face", "conf": 0.97, "bbox": [212, 88, 418, 335]},
    {"class": "pill", "conf": 0.93, "bbox": [301, 402, 336, 431]},
    {"class": "hand", "conf": 0.95, "bbox": [265, 380, 460, 540]}
  ],
  "action_sequence": ["pick_up", "hand_to_mouth", "swallow", "drink_water"],
  "sequence_conf": 0.94,
  "final_decision": "TAKEN",
  "device": "SM-A256N", "fps": 30, "light_lux_est": 320,
  "video_ref": "s3://carelog-vault/2026/06/12/xxx.enc"
}
```

---

## 5. MVP 기능 범위

### 어르신 모드 (극단적 단순화 — 큰 글씨, 버튼 최소화)
- [ ] 홈 = 초대형 "약 먹기" 버튼 1개 (또는 앱 실행 즉시 촬영 화면)
- [ ] 3초 카운트다운 → 자동 녹화(최대 15초) → 분석 중 화면 → 결과 화면("복약 완료! 따님께 알려드렸어요")
- [ ] Bounding Box + 신뢰도 오버레이 표시 (mock 데이터 기반)
- [ ] 복약 스케줄 알림 수신 (아침/점심/저녁, 보호자가 설정)

### 보호자 모드
- [ ] 초대코드로 어르신 계정 연동 (다중 보호자 지원)
- [ ] 대시보드: 오늘의 복약 현황 카드(시간대별 TAKEN/UNCERTAIN/MISSED)
- [ ] 복약 타임라인: 일/주 단위 이력, 이행률 % 그래프
- [ ] 실시간 푸시: 복약 완료, 미복용(스케줄 +30분 경과), 수동확인 요청
- [ ] UNCERTAIN 건 수동확인 처리 (영상 로그 확인 → 확인/미복용 처리)
- [ ] 복약 스케줄 설정 (어르신 대신 세팅)

### 서버
- [ ] Auth: 회원가입/로그인(JWT), 어르신-보호자 초대코드 연동
- [ ] Logs: 복약 로그 CRUD + 통계(일/주 이행률)
- [ ] Schedules: 복약 스케줄 CRUD + 미복용 감지 크론(스케줄 +30분)
- [ ] Realtime: WebSocket 게이트웨이 + Expo Push 발송
- [ ] Media: S3 presigned URL 업로드, 30일 수명주기, AES-256 SSE

### 핵심 API (요약)
```
POST /auth/signup, /auth/login
POST /links/invite-code        # 보호자가 초대코드 생성
POST /links/redeem             # 어르신 기기에서 코드 입력(보호자가 대신)
GET  /users/me/elders          # 연동된 어르신 목록
POST /logs                     # 복약 로그 업로드 (RecognitionResult 포함)
GET  /logs?elderId=&from=&to=  # 타임라인
PATCH /logs/:id/manual-confirm # UNCERTAIN 수동확인
CRUD /schedules
POST /media/presign            # 영상 업로드 presigned URL
WS   /realtime                 # 보호자 구독 채널 (elderId별 room)
```

### DB 스키마 (Prisma 요약)
- `User(id, role: ELDER|GUARDIAN, name, phone, pushToken, createdAt)`
- `Link(id, elderId, guardianId, createdAt)` — 다대다
- `Schedule(id, elderId, slot: MORNING|NOON|EVENING, time, enabled)`
- `MedicationLog(id, elderId, scheduleId?, takenAt, decision, sequenceConf, detectionsJson, actionSequenceJson, videoRef?, manualConfirmedBy?, deviceInfo)`

---

## 6. 마일스톤 (TASKS.md의 상위 구조)

- **M1 — 뼈대**: 모노레포 세팅, Expo 앱 부팅(역할 분기), NestJS+Prisma+PostgreSQL 부팅, shared 타입 패키지
- **M2 — 서비스 플로우(Mock)**: MockRecognitionEngine, 어르신 촬영→판정→로그 업로드, 보호자 대시보드·타임라인, WebSocket 실시간 반영
- **M3 — 알림·폴백**: 스케줄·미복용 크론, Expo Push, UNCERTAIN 수동확인 플로우
- **M4 — 미디어·보안**: S3 presigned 업로드, 30일 수명주기, JWT 가드 정리, 감사 로그
- **M5 — 실모델 준비**: vision-camera frame processor 파이프라인, TFLiteRecognitionEngine 스텁, ai/ 학습 스크립트 스캐폴드
- **M6 — 실모델 교체**: YOLOv8n .tflite 탑재 → 객체 인식 실판정, CNN-BiLSTM 온디바이스 or 서버 추론 결합, 성능 측정 리포트

**Definition of Done(각 태스크)**: 타입 에러 0, lint 통과, 핵심 로직 단위 테스트, 실기기(Expo)에서 동작 확인, TASKS.md 체크 갱신.

---

## 7. 하지 말 것

- 약물 성분 분석·복약 지도·진단성 문구 구현 금지 (비의료 서비스 — "보호자 알림"까지만)
- Mock 단계에서 실모델 라이브러리 선탑재 금지 (앱 크기·빌드 복잡도 증가 방지)
- 영상 원본을 DB에 저장 금지 (S3 참조만), 개인정보 평문 로깅 금지
