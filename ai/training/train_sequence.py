"""CNN-BiLSTM 복약 시퀀스 분류 학습 스크립트 뼈대 (M5-04).

MobileNetV3로 프레임 특징을 뽑고 BiLSTM 2층으로 시간 순서를 판별한다
(CLAUDE.md 2장). 실제 학습은 M6-03에서 수행하고, 지금은 구조와 실행 순서만 확정한다.

사용법:
    python ai/training/train_sequence.py --dry-run   # 의존성 없이 설정만 점검
    python ai/training/train_sequence.py             # 실제 학습 (torch 필요)
"""

from __future__ import annotations

import argparse
import sys

from config import (
    TARGET_SEQUENCE_ACCURACY,
    TARGET_SEQUENCE_FPR,
    SequenceTrainingConfig,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CareLog 복약 시퀀스 분류 학습")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="학습을 실행하지 않고 설정과 경로만 점검한다(무거운 의존성 불필요).",
    )
    parser.add_argument("--epochs", type=int, help="에폭 수 재정의")
    parser.add_argument("--batch-size", type=int, help="배치 크기 재정의")
    parser.add_argument("--device", help="학습 디바이스 재정의 (예: cuda, cpu)")
    return parser.parse_args()


def build_config(args: argparse.Namespace) -> SequenceTrainingConfig:
    config = SequenceTrainingConfig()
    if args.epochs is not None:
        config.epochs = args.epochs
    if args.batch_size is not None:
        config.batch_size = args.batch_size
    if args.device is not None:
        config.device = args.device
    return config


def check_prerequisites(config: SequenceTrainingConfig) -> list[str]:
    problems: list[str] = []

    if not config.clips_dir.exists():
        problems.append(f"클립 디렉터리가 없습니다: {config.clips_dir}")
    if not config.labels_csv.exists():
        problems.append(f"라벨 파일이 없습니다: {config.labels_csv}")

    try:
        import torch  # noqa: F401
    except ImportError:
        problems.append(
            "torch가 설치되지 않았습니다. "
            "pip install -r ai/training/requirements.txt 를 먼저 실행하세요."
        )

    return problems


def build_model(config: SequenceTrainingConfig):
    """MobileNetV3 특징 추출기 + BiLSTM 2층. 무거운 의존성은 여기서만 import한다."""
    import torch.nn as nn  # 지연 import
    from torchvision import models

    backbone = getattr(models, config.backbone)(weights="DEFAULT")
    # 분류 헤드를 떼고 특징 벡터만 쓴다.
    feature_dim = backbone.classifier[0].in_features
    backbone.classifier = nn.Identity()

    class SequenceClassifier(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.backbone = backbone
            self.lstm = nn.LSTM(
                input_size=feature_dim,
                hidden_size=config.hidden_size,
                num_layers=config.num_layers,
                bidirectional=config.bidirectional,
                batch_first=True,
            )
            directions = 2 if config.bidirectional else 1
            self.head = nn.Linear(config.hidden_size * directions, len(config.classes))

        def forward(self, clips):
            # clips: (batch, time, channel, height, width)
            batch, time = clips.shape[:2]
            frames = clips.flatten(0, 1)
            features = self.backbone(frames).view(batch, time, -1)
            sequence, _ = self.lstm(features)
            # 마지막 타임스텝의 은닉 상태로 시퀀스 전체를 판별한다.
            return self.head(sequence[:, -1])

    return SequenceClassifier()


def train(config: SequenceTrainingConfig) -> None:
    """실제 학습 루프. M6-03에서 데이터로더와 함께 채운다."""
    raise NotImplementedError(
        "시퀀스 학습 루프는 M6-03에서 구현합니다. "
        "지금은 --dry-run으로 설정만 점검하세요."
    )


def main() -> int:
    args = parse_args()
    config = build_config(args)

    print("=== CareLog 시퀀스 분류 학습 설정 ===")
    for line in config.describe():
        print(f"  {line}")

    problems = check_prerequisites(config)

    if args.dry_run:
        print("\n=== dry-run: 실행 계획 ===")
        print(f"  1. 클립을 {config.sequence_length} 프레임으로 균등 샘플링")
        print(f"  2. {config.backbone}로 프레임별 특징 추출")
        directions = "양방향" if config.bidirectional else "단방향"
        print(f"  3. BiLSTM {config.num_layers}층({directions})으로 시퀀스 판별")
        print(f"  4. 검증셋 정확도 / FPR 측정 "
              f"(목표 {TARGET_SEQUENCE_ACCURACY}, FPR <= {TARGET_SEQUENCE_FPR})")
        print("  5. 온디바이스 추론이면 TFLite, 서버 추론이면 TorchScript로 내보내기 (M6-03에서 결정)")

        if problems:
            print("\n=== 아직 준비되지 않은 항목 ===")
            for problem in problems:
                print(f"  - {problem}")
            print("\n(dry-run이므로 위 항목은 오류가 아닙니다. M6-03 전까지 채우면 됩니다.)")
        else:
            print("\n모든 준비가 끝났습니다.")

        print("\ndry-run 완료.")
        return 0

    if problems:
        print("\n학습을 시작할 수 없습니다:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    train(config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
