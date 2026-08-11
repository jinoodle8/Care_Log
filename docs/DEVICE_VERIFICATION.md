# 실기기 검증 절차

M3~M5에서 코드는 완성했지만 실기기 없이는 확인할 수 없는 항목을 모았다.
`react-native-vision-camera`(M5-01)를 도입한 시점부터 **Expo Go로는 앱이 뜨지 않는다.**
네이티브 모듈이 포함된 development build가 필요하다.

## 1. Development build 만들기

로컬 빌드는 Java + Android SDK(또는 Xcode)가 필요하다. 없으면 EAS 클라우드 빌드를 쓴다.

```bash
cd apps/mobile && npx eas login
```

```bash
cd apps/mobile && npx eas build --profile development --platform android
```

빌드가 끝나면 나오는 링크에서 APK를 받아 기기에 설치한다. 이후 개발 서버를 붙인다:

```bash
cd apps/mobile && npx expo start --dev-client
```

> iOS는 `--platform ios`로 바꾸고, 무료 계정이면 기기 UDID 등록이 필요하다.

## 1.5 기기가 한 대일 때

역할(어르신/보호자)은 기기에 저장되며 앱 안에 전환 UI가 없다. 한 대로 양쪽을 보려면:

- **어르신 모드는 실기기**(카메라 필요), **보호자 모드는 웹**으로 나눠서 본다.
  보호자 화면은 카메라를 쓰지 않아 브라우저에서 그대로 동작한다.

```bash
cd apps/mobile && npx expo start --web
```

- 굳이 한 기기에서 역할을 바꾸려면 Android 설정 → 앱 → CareLog → 저장공간 →
  **데이터 삭제**로 온보딩부터 다시 시작한다.

푸시 알림(M3-05/06/08)은 실기기 두 대가 있어야 완전히 확인할 수 있다. 한 대뿐이면
어르신 기기에 보호자 계정을 잠시 연동해 자기 자신에게 푸시가 오는지로 대체 확인한다.

## 2. 사전 준비

기기와 PC가 같은 네트워크에 있어야 하고, 앱이 `localhost`가 아닌 PC의 LAN IP로
서버에 접속해야 한다. `apps/mobile/.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:3000
EXPO_PUBLIC_WS_URL=ws://192.168.0.10:3000
```

서버·인프라를 띄운다:

```bash
docker compose up -d && pnpm --filter @carelog/server start:dev
```

푸시 알림(M3-05/06/08)을 확인하려면 실기기에서 Expo 푸시 토큰이 서버에 등록되어야 한다.
앱 로그인 후 `POST /users/me/push-token`이 호출됐는지 서버 로그로 확인한다.

---

## 3. 검증 항목

### M5-01 — frame processor 콜백 빈도

1. 어르신 모드로 "약 먹기" → 카운트다운 → 녹화 화면 진입
2. Metro 콘솔에서 1초마다 다음 로그가 찍히는지 확인

```
[frame-pipeline] 30 fps (30 frames / 1000ms, 33.3ms per frame)
```

- [ ] 로그가 초당 1회 나온다
- [ ] fps가 0이 아니다(프레임이 실제로 들어온다)
- [ ] `ms per frame`을 기록해 둔다 — M6 성능 리포트의 기준선이 된다

`Frame Dropped! Reason: out-of-buffers` 경고가 쏟아지면 프레임 처리가 예산을 넘고 있다는
뜻이다. 지금은 카운터만 올리므로 이 단계에서는 나오지 않아야 정상이다.

### M5-02 — 녹화 플로우 회귀

M2에서 확인했던 흐름이 vision-camera 교체 후에도 같은지 본다.

- [ ] 홈 "약 먹기" → 카메라 권한 요청 → 허용
- [ ] 3초 카운트다운 후 녹화 화면으로 자동 전환
- [ ] 상단에 "촬영 중" 표시
- [ ] 15초 후 자동으로 분석 중 화면으로 전환
- [ ] 결과 화면에 판정이 표시됨
- [ ] 녹화 중 "취소"를 누르면 홈으로 돌아가고 업로드가 일어나지 않음

### M4-02 — 기기 카메라 녹화 → S3 업로드

위 플로우를 한 번 끝낸 뒤:

- [ ] MinIO에 객체가 생성됐는지 확인

```bash
docker run --rm --network care_log_default -e MC_HOST_local="http://carelog:carelog-secret@minio:9000" minio/mc:RELEASE.2025-04-16T18-13-26Z ls -r local/carelog-vault
```

- [ ] 파일 크기가 0이 아니다(실제 영상이 올라갔다)
- [ ] DB에는 참조만 저장됐는지 확인

```bash
docker exec carelog-postgres psql -U carelog -d carelog -c "SELECT id, \"videoRef\" FROM medication_logs ORDER BY \"createdAt\" DESC LIMIT 3;"
```

- [ ] `videoRef`가 `s3://carelog-vault/...` 형식이다
- [ ] 업로드 실패 시에도 로그는 남는지 확인(비행기 모드로 촬영 → `videoRef`가 null인 로그 생성)

### M4-05 — 보호자 앱 영상 재생

보호자 모드로 전환한 뒤:

- [ ] "확인이 필요해요" 화면에 UNCERTAIN 건이 보인다
   (안 나오면 개발자 설정에서 UNCERTAIN 확률을 100%로 올리고 다시 촬영)
- [ ] "영상 보기"를 누르면 영상이 재생된다
- [ ] 재생 후 "복약 확인"/"미복용 처리"가 정상 동작하고 목록에서 사라진다

### M3-07 — 어르신 앱 로컬 알림

1. 보호자 모드에서 스케줄을 **현재 시각 + 2분**으로 설정
2. 어르신 기기에서 홈 화면에 한 번 진입(알림 동기화가 이때 일어난다)
3. 앱을 백그라운드로 보내고 대기

- [ ] 설정한 시각에 "약 드실 시간이에요" 알림이 온다
- [ ] 알림 문구에 슬롯(아침/점심/저녁)이 맞게 들어 있다
- [ ] 알림을 탭하면 어르신 홈 화면(`/elder`)으로 이동한다
- [ ] 스케줄을 바꾸면 다음 알림부터 반영된다(기존 예약이 취소되고 재등록)

> Android 13(API 33) 이상은 `POST_NOTIFICATIONS` 런타임 권한이 필요하다.
> 첫 동기화 시 권한 요청이 뜨며, 거부하면 알림이 조용히 등록되지 않는다.
> 권한을 거부했다면 설정 → 앱 → CareLog → 알림에서 다시 허용할 수 있다.

### 덤 — 푸시 알림 (M3-05/06/08)

기기가 둘이면 함께 확인한다.

- [ ] 어르신이 촬영을 마치면 보호자 기기에 "복약 완료" 푸시가 온다
- [ ] UNCERTAIN 판정이면 "확인이 필요해요" 푸시가 온다
- [ ] 스케줄 +30분이 지나도록 촬영하지 않으면 "미복용" 푸시가 온다

---

## 4. 결과 기록

확인이 끝나면 `docs/TASKS.md`의 해당 항목에서 "**실기기 미검증**" 문구를 지우고,
진행 로그에 검증 일자와 기기명을 남긴다. 문제가 나오면 재현 절차와 함께 이슈로 남긴다.

측정한 `ms per frame` 값은 M6-06 성능 리포트에서 추론 추가 전후를 비교하는 기준선이므로
기기 모델명과 함께 적어 둔다.
