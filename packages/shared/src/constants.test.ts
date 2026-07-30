import { describe, expect, it } from 'vitest';
import { decideFromConf, TAKEN_THRESHOLD, UNCERTAIN_THRESHOLD } from './constants';

describe('decideFromConf', () => {
  it('sequenceConf가 TAKEN 임계값 이상이면 TAKEN', () => {
    expect(decideFromConf(TAKEN_THRESHOLD)).toBe('TAKEN');
    expect(decideFromConf(0.99)).toBe('TAKEN');
  });

  it('sequenceConf가 UNCERTAIN 임계값 이상 TAKEN 임계값 미만이면 UNCERTAIN', () => {
    expect(decideFromConf(UNCERTAIN_THRESHOLD)).toBe('UNCERTAIN');
    expect(decideFromConf(0.89)).toBe('UNCERTAIN');
  });

  it('sequenceConf가 UNCERTAIN 임계값 미만이면 MISSED', () => {
    expect(decideFromConf(0.59)).toBe('MISSED');
    expect(decideFromConf(0)).toBe('MISSED');
  });
});
