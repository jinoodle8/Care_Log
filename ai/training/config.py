"""CareLog 학습 파이프라인 공통 설정.

이 모듈은 표준 라이브러리만 사용한다. train_*.py의 --dry-run이 torch/ultralytics
설치 없이도 돌아야 하기 때문이다(무거운 의존성은 실제 학습 함수 안에서 import한다).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

# ai/training/config.py -> ai/
AI_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = AI_ROOT / "dataset"
EXPORT_DIR = AI_ROOT / "export"
RUNS_DIR = AI_ROOT / "training" / "runs"

# CLAUDE.md 2장 — 객체 인식은 3클래스로 고정한다. 순서가 곧 클래스 인덱스이므로 바꾸면
# 기존 라벨과 학습된 가중치가 모두 어긋난다.
CLASS_NAMES = ["face", "pill", "hand"]

# CLAUDE.md 4장 — 시퀀스 분류가 판별할 동작 단계.
ACTION_STEPS = ["pick_up", "hand_to_mouth", "swallow", "drink_water"]

# 사업계획서 성능 목표. 학습 결과를 이 값과 비교해 리포트한다(M6).
TARGET_DETECTION_MAP50 = 0.95
TARGET_SEQUENCE_ACCURACY = 0.95
TARGET_SEQUENCE_FPR = 0.03
TARGET_FRAME_LATENCY_MS = 33


@dataclass
class YoloTrainingConfig:
    """YOLOv8n(3클래스) 학습 설정."""

    model: str = "yolov8n.pt"
    data_yaml: Path = AI_ROOT / "training" / "data" / "carelog.yaml"
    epochs: int = 100
    image_size: int = 640
    batch_size: int = 16
    device: str = "0"  # "0" = 첫 번째 GPU, "cpu"도 가능
    project: Path = RUNS_DIR / "detect"
    name: str = "carelog-yolov8n"
    # INT8 양자화 TFLite로 내보낸다(CLAUDE.md 2장).
    export_format: str = "tflite"
    export_int8: bool = True

    def describe(self) -> list[str]:
        return [
            f"모델           : {self.model}",
            f"클래스         : {', '.join(CLASS_NAMES)} ({len(CLASS_NAMES)}개)",
            f"데이터 정의    : {self.data_yaml}",
            f"에폭 / 배치    : {self.epochs} / {self.batch_size}",
            f"입력 크기      : {self.image_size}",
            f"디바이스       : {self.device}",
            f"출력           : {self.project / self.name}",
            f"내보내기       : {self.export_format} (int8={self.export_int8})",
            f"목표 mAP@0.5   : {TARGET_DETECTION_MAP50}",
        ]


@dataclass
class SequenceTrainingConfig:
    """CNN-BiLSTM(MobileNetV3 특징 + BiLSTM 2층) 시퀀스 분류 학습 설정."""

    backbone: str = "mobilenet_v3_small"
    hidden_size: int = 128
    num_layers: int = 2
    bidirectional: bool = True
    sequence_length: int = 32  # 15초 녹화를 균등 샘플링한 프레임 수
    epochs: int = 50
    batch_size: int = 8
    learning_rate: float = 1e-3
    device: str = "cuda"
    clips_dir: Path = DATASET_DIR / "clips"
    labels_csv: Path = DATASET_DIR / "labels" / "sequences.csv"
    output_dir: Path = RUNS_DIR / "sequence"
    classes: list[str] = field(default_factory=lambda: list(ACTION_STEPS))

    def describe(self) -> list[str]:
        direction = "양방향" if self.bidirectional else "단방향"
        return [
            f"백본           : {self.backbone}",
            f"LSTM           : {self.num_layers}층 {direction}, hidden={self.hidden_size}",
            f"시퀀스 길이    : {self.sequence_length} 프레임",
            f"동작 단계      : {', '.join(self.classes)}",
            f"에폭 / 배치    : {self.epochs} / {self.batch_size}",
            f"학습률         : {self.learning_rate}",
            f"디바이스       : {self.device}",
            f"클립 경로      : {self.clips_dir}",
            f"라벨 경로      : {self.labels_csv}",
            f"출력           : {self.output_dir}",
            f"목표 정확도    : {TARGET_SEQUENCE_ACCURACY} (FPR <= {TARGET_SEQUENCE_FPR})",
        ]
