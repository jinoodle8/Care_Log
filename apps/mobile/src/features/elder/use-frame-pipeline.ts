import { useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameOutput } from 'react-native-vision-camera';
import type { CameraFrameOutput } from 'react-native-vision-camera';

import { buildFrameRateSample, formatFrameRateSample, type FrameRateSample } from './frame-stats';

const SAMPLE_INTERVAL_MS = 1000;

export interface UseFramePipelineOptions {
  /** false면 프레임 출력을 만들되 계측 로그는 남기지 않는다. */
  enabled?: boolean;
  /** 계측 표본이 나올 때마다 호출된다. 미지정 시 콘솔에 남긴다. */
  onSample?: (sample: FrameRateSample) => void;
}

export interface FramePipeline {
  /** Camera의 outputs에 넘긴다. */
  frameOutput: CameraFrameOutput;
  /** 직전 구간의 계측 결과. 아직 표본이 없으면 null. */
  lastSample: FrameRateSample | null;
}

/**
 * frame processor 파이프라인 골격(M5-01).
 *
 * 지금은 프레임을 받아 세기만 한다. M6에서 이 worklet 안에 YOLOv8n 추론이 들어가고,
 * 그때 프레임당 처리 시간이 예산(33ms) 안에 들어오는지 여기서 나오는 표본으로 판단한다.
 *
 * worklet 런타임은 JS 런타임과 분리되어 있으므로, 카운터는 두 런타임이 공유하는
 * SharedValue에 쌓고 계산·로깅은 JS 쪽 인터벌에서 한다.
 */
export function useFramePipeline({
  enabled = true,
  onSample,
}: UseFramePipelineOptions = {}): FramePipeline {
  const frameCounter = useSharedValue(0);
  const [lastSample, setLastSample] = useState<FrameRateSample | null>(null);

  // 콜백이 바뀌어도 계측 인터벌을 재시작하지 않도록 ref에 담아 둔다.
  const onSampleRef = useRef(onSample);
  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  const frameOutput = useFrameOutput({
    // rgb는 변환 비용이 있지만 LiteRT(TFLite)가 내부적으로 RGB를 쓰므로
    // 카메라 파이프라인에서 한 번에 변환하는 편이 M6에서 유리하다.
    pixelFormat: 'rgb',
    onFrame: (frame) => {
      'worklet';
      frameCounter.value += 1;
      // 처리 후 즉시 반납하지 않으면 이후 프레임이 드롭된다.
      frame.dispose();
    },
  });

  useEffect(() => {
    if (!enabled) return;

    frameCounter.value = 0;
    let startedAt = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const count = frameCounter.value;
      frameCounter.value = 0;

      const sample = buildFrameRateSample(count, now - startedAt);
      startedAt = now;

      setLastSample(sample);
      const callback = onSampleRef.current;
      if (callback) {
        callback(sample);
      } else {
        console.log(`[frame-pipeline] ${formatFrameRateSample(sample)}`);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [enabled, frameCounter]);

  return { frameOutput, lastSample };
}
