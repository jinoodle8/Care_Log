# ai/dataset — 학습 데이터 (M5-05)

**이 디렉터리의 데이터는 git에 절대 커밋하지 않는다.** 어르신의 얼굴이 담긴 영상이므로
저장소에 들어가는 순간 되돌릴 수 없다. `.gitignore`에서 `ai/dataset/`를 통째로 제외하고,
DVC로 버전을 관리한다.

이 README와 `.gitkeep`만 예외적으로 추적된다(구조를 알 수 있게).

## 구조

```
ai/dataset/
├── images/           # YOLOv8n 학습용 프레임
│   ├── train/
│   ├── val/
│   └── test/
├── labels/           # YOLO 형식 bbox 라벨 (images와 파일명 1:1)
│   ├── train/
│   ├── val/
│   ├── test/
│   └── sequences.csv # 시퀀스 분류용 클립 라벨
└── clips/            # CNN-BiLSTM 학습용 원본 클립(10~15초)
```

클래스 인덱스는 `ai/training/config.py`의 `CLASS_NAMES` 순서를 따른다:
`0: face`, `1: pill`, `2: hand`. 이 순서를 바꾸면 기존 라벨이 전부 어긋난다.

## DVC 사용법

```bash
pip install -r ai/training/requirements.txt
```

원격 저장소 자격증명은 각자 로컬에 설정한다(`.dvc/config.local`은 git에서 제외됨):

```bash
dvc remote modify --local carelog-dataset endpointurl http://localhost:9000
dvc remote modify --local carelog-dataset access_key_id <키>
dvc remote modify --local carelog-dataset secret_access_key <시크릿>
```

데이터를 추가하고 올릴 때:

```bash
dvc add ai/dataset/images
git add ai/dataset/images.dvc
dvc push
```

받을 때:

```bash
dvc pull
```

## 수집·보관 원칙

- 촬영 대상자에게 수집·이용 목적을 고지하고 동의를 받은 영상만 사용한다.
- 파일명·경로에 이름·전화번호 등 식별 정보를 넣지 않는다. 익명 ID를 쓴다.
- 학습이 끝난 원본 클립은 보관 기간을 정해 정리한다(서비스 영상의 30일 정책과 별개로,
  학습 데이터는 동의 범위 내에서 관리).
- 데이터셋 원격 버킷도 서비스 버킷과 동일하게 퍼블릭 접근을 차단한다.
