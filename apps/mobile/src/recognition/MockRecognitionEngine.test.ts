import { TAKEN_THRESHOLD, UNCERTAIN_THRESHOLD } from '@carelog/shared';
import { MockRecognitionEngine } from './MockRecognitionEngine';

const SAMPLE_SIZE = 1000;
const TOLERANCE = 0.05;

describe('MockRecognitionEngine', () => {
  it('설정된 확률(takenRate/uncertainRate/missedRate)대로 판정을 샘플링한다', async () => {
    const engine = new MockRecognitionEngine({
      takenRate: 0.9,
      uncertainRate: 0.08,
      delayMsRange: [0, 0],
    });

    const counts = { TAKEN: 0, UNCERTAIN: 0, MISSED: 0 };
    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      const result = await engine.analyze({ durationMs: 10000 });
      counts[result.finalDecision] += 1;
    }

    expect(counts.TAKEN / SAMPLE_SIZE).toBeGreaterThan(0.9 - TOLERANCE);
    expect(counts.TAKEN / SAMPLE_SIZE).toBeLessThan(0.9 + TOLERANCE);
    expect(counts.UNCERTAIN / SAMPLE_SIZE).toBeGreaterThan(0.08 - TOLERANCE);
    expect(counts.UNCERTAIN / SAMPLE_SIZE).toBeLessThan(0.08 + TOLERANCE);
    expect(counts.MISSED / SAMPLE_SIZE).toBeGreaterThan(0.02 - TOLERANCE);
    expect(counts.MISSED / SAMPLE_SIZE).toBeLessThan(0.02 + TOLERANCE);
  }, 15000);

  it('finalDecision에 따라 판정 정책과 정합되는 sequenceConf를 반환한다', async () => {
    const engine = new MockRecognitionEngine({ delayMsRange: [0, 0] });

    for (let i = 0; i < 200; i += 1) {
      const result = await engine.analyze({ durationMs: 10000 });
      if (result.finalDecision === 'TAKEN') {
        expect(result.sequenceConf).toBeGreaterThanOrEqual(TAKEN_THRESHOLD);
      } else if (result.finalDecision === 'UNCERTAIN') {
        expect(result.sequenceConf).toBeGreaterThanOrEqual(UNCERTAIN_THRESHOLD);
        expect(result.sequenceConf).toBeLessThan(TAKEN_THRESHOLD);
      } else {
        expect(result.sequenceConf).toBeLessThan(UNCERTAIN_THRESHOLD);
      }
    }
  });

  it('detections은 face/pill/hand 3종을 화면 중앙 근처 bbox로 반환한다', async () => {
    const engine = new MockRecognitionEngine({ delayMsRange: [0, 0] });
    const result = await engine.analyze({ durationMs: 10000 });

    expect(result.detections.map((d) => d.cls).sort()).toEqual(['face', 'hand', 'pill']);
    for (const detection of result.detections) {
      expect(detection.conf).toBeGreaterThanOrEqual(0.85);
      expect(detection.conf).toBeLessThanOrEqual(0.99);
      const [x1, y1, x2, y2] = detection.bbox;
      expect(x1).toBeGreaterThanOrEqual(0);
      expect(y1).toBeGreaterThanOrEqual(0);
      expect(x2).toBeLessThanOrEqual(1);
      expect(y2).toBeLessThanOrEqual(1);
      expect(x2).toBeGreaterThan(x1);
      expect(y2).toBeGreaterThan(y1);
    }
  });

  it('demoMode=true이면 항상 TAKEN·sequenceConf=0.98을 반환한다', async () => {
    const engine = new MockRecognitionEngine({ demoMode: true, delayMsRange: [0, 0] });

    for (let i = 0; i < 20; i += 1) {
      const result = await engine.analyze({ durationMs: 10000 });
      expect(result.finalDecision).toBe('TAKEN');
      expect(result.sequenceConf).toBe(0.98);
    }
  });

  it('session.demoMode가 생성자 옵션보다 우선한다', async () => {
    const engine = new MockRecognitionEngine({ demoMode: false, delayMsRange: [0, 0] });
    const result = await engine.analyze({ durationMs: 10000, demoMode: true });
    expect(result.finalDecision).toBe('TAKEN');
  });
});
