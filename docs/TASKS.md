# CareLog TASKS (마일스톤 → 커밋 단위 태스크)

> `docs/PRD.md`, `docs/TRD.md` 승인 후 M1부터 순서대로 진행한다.
> **규칙(CLAUDE.md 0장)**: 태스크 1개 = 커밋 1개. 커밋 메시지 `feat|fix|chore(scope): 내용`.
> **DoD(CLAUDE.md 6장)**: 타입 에러 0, lint 통과, 핵심 로직 단위 테스트, 실기기(Expo)에서 동작 확인, 본 파일 체크 갱신.
> 각 태스크는 30분~2시간 분량을 목표로 분해했다. `[검증]`은 완료 확인 방법.

---

## M1 — 뼈대

### 모노레포 세팅
- [ ] **M1-01** `pnpm` 워크스페이스 루트 세팅 (`pnpm-workspace.yaml`, 루트 `package.json`, `.gitignore`, `.editorconfig`)
  `[검증]` `pnpm install`이 에러 없이 완료
- [ ] **M1-02** 루트 공통 tooling: ESLint + Prettier + TypeScript base config (`tsconfig.base.json`), husky/lint-staged(선택)
  `[검증]` `pnpm lint`가 루트에서 실행됨(대상 없음 상태라도 통과)
- [ ] **M1-03** Git 저장소 초기화 + 최초 커밋(`CLAUDE.md`, `docs/*`, 루트 세팅 파일)
  `[검증]` `git log`에 초기 커밋 확인

### packages/shared
- [ ] **M1-04** `packages/shared` 패키지 스캐폴드(package.json, tsconfig, 빌드 스크립트)
  `[검증]` `pnpm --filter shared build` 성공
- [ ] **M1-05** `recognition.ts` 작성 — CLAUDE.md 4장의 `Detection`/`ActionStep`/`RecognitionResult`/`RecognitionEngine` 타입 + `FrameSource` 최소 타입
  `[검증]` 타입 export 확인, `tsc --noEmit` 통과
- [ ] **M1-06** `constants.ts` 작성 — 판정 정책 상수(`TAKEN_THRESHOLD` 등), 판정 함수 `decideFromConf(conf: number): Decision` 단위 테스트 포함
  `[검증]` `pnpm --filter shared test` 통과 (경계값 0.60/0.90 테스트)
- [ ] **M1-07** `log.ts`, `dto/` — `MedicationLog` 관련 타입 및 API DTO 타입 정의 (TRD 4장 Prisma 스키마와 정합)
  `[검증]` 타입 컴파일 통과, TRD 스키마와 필드명 대조 확인

### apps/server 부팅
- [ ] **M1-08** NestJS 프로젝트 스캐폴드 (`nest new` 기반, `apps/server`) + `packages/shared` 의존성 연결
  `[검증]` `pnpm --filter server start:dev`로 기본 서버 기동, `GET /` 200 응답
- [ ] **M1-09** Prisma 설정 + PostgreSQL 연결(`DATABASE_URL`), `.env.example` 작성
  `[검증]` `pnpm --filter server prisma:generate` 성공
- [ ] **M1-10** TRD 4장 스키마 작성(`schema.prisma`: User/Link/InviteCode/Schedule/MedicationLog) + 최초 마이그레이션
  `[검증]` `prisma migrate dev` 성공, `prisma studio`로 테이블 확인
- [ ] **M1-11** 공통 에러 처리(`common/filters/http-exception.filter.ts`) + 검증 파이프(`ValidationPipe` 전역 설정)
  `[검증]` 존재하지 않는 라우트 호출 시 통일된 에러 JSON 포맷 응답

### apps/mobile 부팅
- [ ] **M1-12** Expo(TypeScript) 프로젝트 스캐폴드 (`apps/mobile`, expo-router 기반) + `packages/shared` 의존성 연결
  `[검증]` `pnpm --filter mobile start` → Expo Go에서 기본 화면 로드
- [ ] **M1-13** 역할 분기 스토어/라우팅 골격 — 로컬 저장(AsyncStorage)에 역할(`ELDER`/`GUARDIAN`/미설정) 저장, 앱 진입 시 역할에 따라 라우트 분기
  `[검증]` 역할 미설정 시 온보딩 화면, 역할 설정 후 재실행 시 해당 모드로 직행 (Expo Go 수동 확인)
- [ ] **M1-14** 온보딩 화면 뼈대(PRD 4.1.1) — "보호자로 시작" / "초대코드로 어르신 기기 설정" 두 경로 UI만(로직은 M2에서 API 연결)
  `[검증]` 두 버튼 탭 시 각 플레이스홀더 화면으로 이동

### M1 마무리
- [ ] **M1-15** 루트 README 작성 — 개발 환경 세팅/실행 방법 요약 (Windows+WSL2, pnpm, 각 앱 실행 커맨드)
  `[검증]` 새 환경에서 README만 보고 서버+모바일 기동 가능한지 셀프 점검

---

## M2 — 서비스 플로우 (Mock)

### Mock 인식 엔진
- [ ] **M2-01** `apps/mobile/src/recognition/MockRecognitionEngine.ts` 구현 (TRD 3.2, 확률 테이블 + 지연 시뮬레이션)
  `[검증]` 유닛 테스트로 1000회 샘플링 시 TAKEN/UNCERTAIN/MISSED 비율이 설정값 ±5% 이내
- [ ] **M2-02** `demoMode` 토글 + `getRecognitionEngine()` 팩토리(`recognition/index.ts`, env 플래그 `RECOGNITION_ENGINE=mock` 고정)
  `[검증]` `demoMode=true` 시 100% TAKEN 유닛 테스트
- [ ] **M2-03** 개발자 설정 화면(간단 토글 UI, 어르신 모드에는 노출 안 함) — 데모 모드/확률값 조정
  `[검증]` Expo Go에서 토글 변경 시 다음 촬영 결과에 반영

### 어르신 모드 화면
- [ ] **M2-04** 홈 화면(PRD 4.2.1) — 초대형 "약 먹기" 버튼, 카메라 권한 요청 플로우
  `[검증]` 권한 거부 시 안내 화면, 허용 시 카운트다운 화면 이동 (실기기)
- [ ] **M2-05** 카운트다운 화면(PRD 4.2.2) — 3초 카운트다운 → 자동 녹화 시작 UI (카메라는 `expo-camera` 기본 녹화만 사용, frame processor 미사용)
  `[검증]` 카운트다운 후 자동 녹화 화면 전환 확인(실기기)
- [ ] **M2-06** 녹화 화면 — 최대 15초 자동 종료, 취소(뒤로가기) 옵션
  `[검증]` 15초 경과 시 자동으로 분석 중 화면 전환
- [ ] **M2-07** 분석 중 화면(PRD 4.2.3) — `MockRecognitionEngine.analyze()` 호출, 로딩 UI, 네트워크 오류 재시도 버튼
  `[검증]` 3~5초 후 결과 화면 전환(실기기)
- [ ] **M2-08** 결과 화면(PRD 4.2.4) — TAKEN/UNCERTAIN/MISSED별 메시지 분기 + Bounding Box/신뢰도 오버레이 렌더링(mock detections 기반)
  `[검증]` 세 가지 판정 각각 실기기에서 문구/오버레이 확인(데모 모드로 강제 전환하며 테스트)

### 로그 업로드 & 서버 API (Mock 연동)
- [ ] **M2-09** 서버 `logs` 모듈 — `POST /logs`, `GET /logs`(elderId/from/to 필터) 구현 + DTO 검증
  `[검증]` supertest e2e: 로그 생성 후 조회 시 반영 확인
- [ ] **M2-10** 서버 `logs/stats` — 일/주 이행률 계산 로직(`packages/shared` 판정 상수 재사용)
  `[검증]` 유닛 테스트: 스케줄 4건 중 TAKEN 3건 → 75% 계산 검증
- [ ] **M2-11** 모바일 API 클라이언트(`src/api`) — axios 인스턴스, 로그 업로드 함수, 에러 인터셉터 골격
  `[검증]` 결과 화면에서 로그 업로드 성공 시 서버 DB에 레코드 생성 확인(Prisma studio)

### 인증 & 연동 (Mock 플로우 완성에 필요한 최소 범위)
- [ ] **M2-12** 서버 `auth` 모듈 — `POST /auth/signup`, `/auth/login`, JWT 발급(access/refresh)
  `[검증]` e2e: 회원가입 → 로그인 → JWT 페이로드 확인
- [ ] **M2-13** 서버 `links` 모듈 — `POST /links/invite-code`(24h 만료), `POST /links/redeem`
  `[검증]` e2e: 초대코드 생성 → redeem → Link 레코드 생성, 만료 코드 redeem 시 `INVITE_CODE_EXPIRED` 에러
- [ ] **M2-14** 모바일 온보딩 로직 연결 — 보호자 회원가입/로그인 화면, 초대코드 생성/입력 화면을 실제 API에 연결
  `[검증]` 실기기 2대(또는 시뮬레이터+실기기)로 보호자 계정 생성 → 초대코드 → 어르신 기기 연동 E2E 확인
- [ ] **M2-15** JWT 가드 기본 적용(`@UseGuards(JwtAuthGuard)`) — `logs`, `schedules`(스텁) 등 인증 필요한 라우트에 적용
  `[검증]` 토큰 없이 호출 시 401 확인

### 보호자 모드 화면
- [ ] **M2-16** 대시보드 화면(PRD 4.3.2) — 오늘의 복약 현황 카드(시간대별 상태), `GET /logs` 연동
  `[검증]` 어르신 기기에서 촬영 완료 후 보호자 화면 새로고침 시 반영(실기기)
- [ ] **M2-17** 복약 타임라인 화면(PRD 4.3.3) — 일 단위 리스트 + 주 단위 이행률 그래프(`/logs/stats` 연동)
  `[검증]` 목데이터 여러 건 생성 후 그래프 수치 육안 검증

### WebSocket 실시간 반영
- [ ] **M2-18** 서버 `realtime` Gateway 골격 — `/realtime` namespace, JWT handshake 인증, `elder:{elderId}` room join
  `[검증]` 유닛/통합 테스트: 미인증 연결 거부, 연동 안 된 elderId room join 거부
- [ ] **M2-19** `logs` 생성 시 `log.created` 이벤트 브로드캐스트 연결
  `[검증]` 서버 통합 테스트로 이벤트 수신 확인
- [ ] **M2-20** 모바일 보호자 대시보드에 WebSocket 클라이언트 연결 — 실시간 카드 갱신
  `[검증]` 어르신 기기 촬영 → 3초 이내 보호자 화면 자동 갱신(폴링 없이) 실기기 확인

---

## M3 — 알림 · 폴백

- [ ] **M3-01** 서버 `schedules` 모듈 CRUD (`GET/POST/PATCH/DELETE /schedules`) + 슬롯 중복 방지(`@@unique([elderId, slot])`)
  `[검증]` e2e: 동일 슬롯 중복 생성 시 `SCHEDULE_SLOT_DUPLICATE` 에러
- [ ] **M3-02** 모바일 보호자용 스케줄 설정 화면(PRD 4.3.6)
  `[검증]` 실기기에서 슬롯 시각 저장 → 서버 DB 반영 확인
- [ ] **M3-03** 미복용 감지 크론(서버) — 스케줄 +30분 경과 & 해당 슬롯 로그 없음 → 감지 로직(멱등 처리 포함)
  `[검증]` 유닛 테스트: 스케줄 시각 조작 후 크론 함수 단독 호출 시 감지 대상 목록 정확성 확인
- [ ] **M3-04** Expo Push 발송 모듈(서버) — `expo-server-sdk` 연동, 토큰 없는 유저 스킵 처리
  `[검증]` 유닛 테스트(모킹) + 실기기 1건 발송 확인(Expo Push Tool 또는 실제 토큰)
- [ ] **M3-05** 복약 완료(`TAKEN`) 푸시 연동 — 로그 생성 시 보호자에게 발송
  `[검증]` 실기기: 어르신 촬영 완료 후 보호자 기기에 푸시 수신
- [ ] **M3-06** 미복용 의심 푸시 연동 — M3-03 크론 결과를 M3-04로 발송
  `[검증]` 스케줄 시각을 과거로 세팅해 강제로 크론 트리거 후 푸시 수신 확인
- [ ] **M3-07** 어르신 앱 로컬 알림 — 스케줄 시각에 맞춘 로컬 푸시(PRD 4.2.5), 탭 시 홈 화면 이동
  `[검증]` 실기기에서 스케줄 시각 도달 시 알림 수신 및 탭 동작 확인
- [ ] **M3-08** `UNCERTAIN` 판정 시 "수동확인 요청" 푸시 연동
  `[검증]` Mock 엔진 확률을 UNCERTAIN 100%로 조정 후 실기기 푸시 확인
- [ ] **M3-09** 서버 `PATCH /logs/:id/manual-confirm` 구현(TRD 5.2) — `manualConfirmedBy`, `decision` 갱신
  `[검증]` e2e: UNCERTAIN 로그 수동확인 처리 후 GET 조회 시 반영
- [ ] **M3-10** 모바일 보호자 UNCERTAIN 리스트/필터 화면(PRD 4.3.5) — 목록 UI + 필터
  `[검증]` UNCERTAIN 로그만 정확히 필터링되는지 실기기 확인
- [ ] **M3-11** 수동확인 상세 화면 — 판정 근거(신뢰도/시퀀스) 표시 + 확인/미복용 처리 버튼 (영상 재생은 M4 이후 presigned URL 준비되면 연결, 이 태스크에서는 UI+API 연동까지)
  `[검증]` 버튼 클릭 시 M3-09 API 호출 및 목록에서 상태 변경 반영 확인
- [ ] **M3-12** `log.updated` WebSocket 이벤트 — 수동확인 시 보호자 대시보드/타임라인 실시간 반영
  `[검증]` 수동확인 처리 후 다른 화면(대시보드)에서 새로고침 없이 상태 갱신 확인

---

## M4 — 미디어 · 보안

- [ ] **M4-01** 서버 `media` 모듈 — `POST /media/presign`(S3 presigned PUT URL 발급), MinIO 로컬 개발 환경 설정
  `[검증]` presign 발급 후 curl/Postman으로 실제 PUT 업로드 성공
- [ ] **M4-02** 모바일 녹화 영상 업로드 연동 — 분석 완료 후 영상 파일을 presigned URL로 직접 S3 업로드, `videoRef`를 로그 업로드 payload에 포함
  `[검증]` 실기기 촬영 → S3(MinIO) 버킷에 파일 생성 확인, DB엔 참조 경로만 저장됨을 확인
- [ ] **M4-03** S3 SSE(AES-256) 암호화 설정 + 버킷 정책(퍼블릭 접근 차단)
  `[검증]` 버킷 정책/암호화 설정 스크립트 또는 IaC 문서화, 업로드 객체의 암호화 헤더 확인
- [ ] **M4-04** S3 30일 라이프사이클 정책 설정(자동 만료/삭제)
  `[검증]` 라이프사이클 규칙 콘솔/CLI로 확인(로컬 MinIO는 문서화로 대체 가능)
- [ ] **M4-05** UNCERTAIN 상세 화면에 영상 재생 연동(M3-11에서 미룬 부분) — presigned GET URL로 재생
  `[검증]` 실기기에서 업로드된 영상 재생 확인
- [ ] **M4-06** JWT 가드 정리 — 전체 라우트 인증/역할(ELDER/GUARDIAN) 가드 재점검, `NOT_LINKED_ELDER` 등 권한 에러 코드 일관 적용
  `[검증]` 연동 안 된 elderId로 API 호출 시 403 확인(모든 관련 엔드포인트 점검 체크리스트)
- [ ] **M4-07** 감사 로그(Audit Log) — 수동확인 처리, 스케줄 변경 등 민감 액션 로깅(개인정보 평문 로깅 금지 원칙 준수, 어떤 필드를 마스킹할지 정의)
  `[검증]` 감사 로그 테이블/파일에 액션 기록 확인, 로그 내 전화번호 등 마스킹 확인
- [ ] **M4-08** 보안 점검 — CORS 설정, rate limiting(`@nestjs/throttler`), 환경변수 시크릿 노출 여부(`EXPO_PUBLIC_` 오남용) 점검
  `[검증]` 체크리스트 문서화 + 취약점 스캔(예: `pnpm audit`) 결과 정리

---

## M5 — 실모델 준비

> 이 마일스톤부터 실모델 관련 라이브러리(`react-native-fast-tflite` 등) 설치를 시작한다. 그 전까지는 절대 설치하지 않는다.

- [ ] **M5-01** `react-native-vision-camera` 도입 + frame processor 파이프라인 골격(프레임을 콜백으로 받는 구조까지, 아직 추론 없음)
  `[검증]` 실기기에서 frame processor 콜백이 초당 N회 호출되는지 로그로 확인
- [ ] **M5-02** 기존 `expo-camera` 기반 녹화 화면을 vision-camera로 교체(녹화 기능 동등성 유지)
  `[검증]` M2에서 검증한 녹화 플로우(카운트다운→녹화→분석중→결과)가 회귀 없이 동작
- [ ] **M5-03** `TFLiteRecognitionEngine` 스텁 생성(`recognition/TFLiteRecognitionEngine.ts`) — `analyze()`는 미구현 예외 또는 Mock 위임, 팩토리에 `RECOGNITION_ENGINE=tflite` 분기 추가(기본값은 여전히 mock)
  `[검증]` env 플래그 전환 시 팩토리가 올바른 엔진 인스턴스 반환하는 유닛 테스트
- [ ] **M5-04** `ai/training` 스캐폴드 — Python 가상환경(requirements.txt), YOLOv8n 학습 스크립트 뼈대(Ultralytics), CNN-BiLSTM 학습 스크립트 뼈대(구조만, 학습 데이터 없이 dry-run 가능한 더미 데이터 경로)
  `[검증]` `python ai/training/train_yolo.py --dry-run` 등으로 스크립트 문법/의존성 오류 없이 종료
- [ ] **M5-05** `ai/dataset` DVC 초기화(또는 대체 관리 방식 문서화) — git 제외 설정 확인
  `[검증]` `dataset/`가 `.gitignore`에 포함되고 DVC 초기화 커밋 확인
- [ ] **M5-06** `ai/export` 산출물 규격 문서화 — `.tflite` 파일명 규칙, 버전 관리, 앱 번들 포함 방식(`apps/mobile/assets/models/`) 정의
  `[검증]` 문서 리뷰만으로 완료 처리(코드 변경 없음 가능)

---

## M6 — 실모델 교체

- [ ] **M6-01** YOLOv8n(3클래스: face/pill/hand) 학습 파이프라인 완성 + INT8 양자화 → TFLite export
  `[검증]` `ai/export`에 `.tflite` 산출물 생성, mAP@0.5 측정 리포트 작성
- [ ] **M6-02** `react-native-fast-tflite` 도입 + 모델 로드/추론 기본 동작 검증(단일 프레임 추론)
  `[검증]` 실기기에서 프레임당 추론 결과(Detection[]) 콘솔 출력 확인
- [ ] **M6-03** CNN-BiLSTM(MobileNetV3 특징 + BiLSTM 2층) 시퀀스 분류 모델 학습 및 export(온디바이스 or 서버 추론 방식 결정 포함)
  `[검증]` 검증셋 정확도 ≥ 95%, FPR ≤ 3% 리포트
- [ ] **M6-04** `TFLiteRecognitionEngine.analyze()` 실구현 — YOLOv8n 프레임별 추론 → 시퀀스 버퍼링 → CNN-BiLSTM 판별 → `RecognitionResult` 조립
  `[검증]` 실기기 촬영 시 mock이 아닌 실제 추론 결과가 결과 화면에 표시됨
- [ ] **M6-05** 판정 정책(TRD 5.1) 실모델 결과에 동일 적용 + 최종 판정 정확도 측정
  `[검증]` 사업계획서 목표(최종 판정 정확도 98%) 대비 측정 리포트 작성
- [ ] **M6-06** 성능 측정 — 프레임당 추론 시간(≤33ms 목표), 푸시 지연(≤3초) 실측
  `[검증]` 중급 기기 기준 성능 리포트를 `docs/`에 추가(예: `docs/PERF_REPORT.md`)
- [ ] **M6-07** `RECOGNITION_ENGINE` 기본값을 `tflite`로 전환 여부 결정 + 롤백 플랜(문제 시 mock/기존 버전으로 즉시 전환 가능한 구조 재확인)
  `[검증]` 플래그 전환/롤백 양방향 동작 확인

---

## 진행 로그

> 태스크 완료 시 이 표에 한 줄씩 추가한다 (날짜, 태스크 ID, 커밋 해시).

| 날짜 | 태스크 | 커밋 |
|---|---|---|
| - | - | - |
