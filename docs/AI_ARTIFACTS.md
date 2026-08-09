# AI 산출물 규격 (M5-06)

학습 결과물(`.tflite`)이 앱에 들어가는 경로와 규칙을 정한다. 모델은 판정 결과를 바꾸므로,
"어떤 모델이 어떤 판정을 냈는지"를 나중에 되짚을 수 있어야 한다.

---

## 1. 파일명 규칙

```
carelog-<역할>-v<major>.<minor>-<정밀도>.tflite
```

| 요소 | 값 | 설명 |
|---|---|---|
| 역할 | `detector` \| `sequence` | detector = YOLOv8n(face/pill/hand), sequence = CNN-BiLSTM |
| major | 정수 | 입출력 텐서 모양이나 클래스 구성이 바뀌면 올린다(앱 코드 수정 필요) |
| minor | 정수 | 같은 구조로 재학습해 성능만 달라졌을 때 올린다(앱 코드 수정 불필요) |
| 정밀도 | `int8` \| `fp16` \| `fp32` | 양자화 수준. 기본은 `int8` |

예시:

```
carelog-detector-v1.0-int8.tflite
carelog-detector-v1.1-int8.tflite     # 재학습, 앱 코드 그대로
carelog-detector-v2.0-int8.tflite     # 클래스 추가 → 앱 코드 수정 필요
carelog-sequence-v1.0-fp16.tflite
```

## 2. 디렉터리

| 경로 | 용도 | git |
|---|---|---|
| `ai/export/` | 학습 스크립트가 내보낸 원본 산출물 | `*.tflite` 제외 |
| `ai/export/manifest.json` | 버전별 메타데이터·성능 지표 | **추적함** |
| `apps/mobile/assets/models/` | 앱 번들에 실제로 들어가는 모델 | 제외(용량) |

`.tflite` 바이너리는 git에 넣지 않는다. `ai/dataset`과 동일하게 DVC로 관리하며,
릴리스 시점의 모델은 `manifest.json`의 체크섬으로 특정한다.

## 3. manifest.json

산출물마다 한 항목씩 추가한다. 어떤 데이터로 학습해 어떤 성능이 나왔는지를 남겨,
나중에 "이 판정은 어느 모델이 냈는가"를 추적할 수 있게 한다.

```json
{
  "models": [
    {
      "file": "carelog-detector-v1.0-int8.tflite",
      "role": "detector",
      "version": "1.0",
      "precision": "int8",
      "sha256": "<파일 체크섬>",
      "sizeBytes": 6291456,
      "inputShape": [1, 640, 640, 3],
      "classes": ["face", "pill", "hand"],
      "trainedAt": "2026-09-01",
      "datasetRevision": "<dvc 커밋 해시>",
      "metrics": { "mAP50": 0.96, "mAP50_95": 0.71 },
      "notes": "초판"
    }
  ]
}
```

`datasetRevision`은 `dvc.lock` 또는 `*.dvc` 파일의 해시를 적어 학습 데이터와 모델을 묶는다.

## 4. 앱 번들 포함 방식

```
apps/mobile/assets/models/
├── carelog-detector-v1.0-int8.tflite
└── carelog-sequence-v1.0-fp16.tflite
```

`TFLiteRecognitionEngine`에 경로로 주입한다(M5-03에서 이미 받도록 열어 뒀다):

```ts
new TFLiteRecognitionEngine({
  detectorModelPath: 'models/carelog-detector-v1.0-int8.tflite',
  sequenceModelPath: 'models/carelog-sequence-v1.0-fp16.tflite',
});
```

Metro가 `.tflite`를 에셋으로 인식하도록 `metro.config.js`에
`assetExts.push('tflite')`를 추가해야 한다(M6-02에서 처리).

## 5. 버전 올릴 때 확인할 것

- [ ] `manifest.json`에 항목 추가(체크섬·성능 지표 포함)
- [ ] major가 올랐다면 `TFLiteRecognitionEngine`의 전처리·후처리 코드 점검
- [ ] 성능 목표 대비 측정: 검출 mAP@0.5 ≥ 0.95, 시퀀스 정확도 ≥ 95%·FPR ≤ 3%, 프레임당 ≤ 33ms
- [ ] 앱 번들 크기 변화 확인(INT8 기준 detector 6MB 내외 예상)
- [ ] 롤백 경로 확인 — `EXPO_PUBLIC_RECOGNITION_ENGINE=mock`으로 즉시 되돌릴 수 있는지(M6-07)

## 6. 판정 추적

복약 로그에는 어떤 모델이 판정했는지 남길 수 있어야 한다. M6-04에서
`MedicationLog.deviceInfo`에 다음을 함께 기록한다:

```json
{ "detectorModel": "carelog-detector-v1.0-int8", "sequenceModel": "carelog-sequence-v1.0-fp16" }
```

모델 버전은 개인정보가 아니므로 감사 로그 마스킹 대상이 아니다.
