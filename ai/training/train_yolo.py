"""YOLOv8n(face/pill/hand) 학습 스크립트 뼈대 (M5-04).

실제 학습은 M6-01에서 데이터셋이 모인 뒤 수행한다. 지금은 설정과 실행 순서를
확정해 두고, --dry-run으로 스크립트가 깨지지 않는지 확인할 수 있게 한다.

사용법:
    python ai/training/train_yolo.py --dry-run     # 의존성 없이 설정만 점검
    python ai/training/train_yolo.py               # 실제 학습 (ultralytics 필요)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from config import CLASS_NAMES, EXPORT_DIR, YoloTrainingConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CareLog YOLOv8n 학습")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="학습을 실행하지 않고 설정과 경로만 점검한다(무거운 의존성 불필요).",
    )
    parser.add_argument("--epochs", type=int, help="에폭 수 재정의")
    parser.add_argument("--batch-size", type=int, help="배치 크기 재정의")
    parser.add_argument("--device", help="학습 디바이스 재정의 (예: 0, cpu)")
    parser.add_argument(
        "--no-export",
        action="store_true",
        help="학습 후 TFLite 내보내기를 건너뛴다.",
    )
    return parser.parse_args()


def build_config(args: argparse.Namespace) -> YoloTrainingConfig:
    config = YoloTrainingConfig()
    if args.epochs is not None:
        config.epochs = args.epochs
    if args.batch_size is not None:
        config.batch_size = args.batch_size
    if args.device is not None:
        config.device = args.device
    return config


def check_prerequisites(config: YoloTrainingConfig) -> list[str]:
    """실제 학습 전에 갖춰져야 할 것들. 없는 항목을 사람이 읽을 수 있는 문장으로 돌려준다."""
    problems: list[str] = []

    if not config.data_yaml.exists():
        problems.append(f"데이터 정의 파일이 없습니다: {config.data_yaml}")

    try:
        import ultralytics  # noqa: F401
    except ImportError:
        problems.append(
            "ultralytics가 설치되지 않았습니다. "
            "pip install -r ai/training/requirements.txt 를 먼저 실행하세요."
        )

    return problems


def train(config: YoloTrainingConfig, export: bool) -> Path:
    """실제 학습. 무거운 의존성은 여기서만 import한다."""
    from ultralytics import YOLO  # 지연 import — dry-run 경로에서는 필요 없다.

    model = YOLO(config.model)
    model.train(
        data=str(config.data_yaml),
        epochs=config.epochs,
        imgsz=config.image_size,
        batch=config.batch_size,
        device=config.device,
        project=str(config.project),
        name=config.name,
    )

    weights = config.project / config.name / "weights" / "best.pt"
    if not export:
        return weights

    # INT8 TFLite로 내보내 앱 번들에 넣는다(파일명 규칙은 docs/AI_ARTIFACTS.md).
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    exported = YOLO(str(weights)).export(
        format=config.export_format,
        int8=config.export_int8,
        imgsz=config.image_size,
    )
    return Path(exported)


def main() -> int:
    args = parse_args()
    config = build_config(args)

    print("=== CareLog YOLOv8n 학습 설정 ===")
    for line in config.describe():
        print(f"  {line}")

    problems = check_prerequisites(config)

    if args.dry_run:
        print("\n=== dry-run: 실행 계획 ===")
        print("  1. 데이터셋 로드 및 3클래스 라벨 검증")
        print(f"  2. {config.model}에서 파인튜닝 ({config.epochs} 에폭)")
        print("  3. 검증셋 mAP@0.5 측정")
        if not args.no_export:
            print(f"  4. INT8 {config.export_format}로 내보내기 -> {EXPORT_DIR}")

        if problems:
            print("\n=== 아직 준비되지 않은 항목 ===")
            for problem in problems:
                print(f"  - {problem}")
            print("\n(dry-run이므로 위 항목은 오류가 아닙니다. M6-01 전까지 채우면 됩니다.)")
        else:
            print("\n모든 준비가 끝났습니다. --dry-run 없이 실행하면 학습이 시작됩니다.")

        print(f"\ndry-run 완료. 클래스 {len(CLASS_NAMES)}개: {', '.join(CLASS_NAMES)}")
        return 0

    if problems:
        print("\n학습을 시작할 수 없습니다:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    artifact = train(config, export=not args.no_export)
    print(f"\n완료. 산출물: {artifact}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
