import { formatTimeLabel, isValidTime, shiftTime } from './schedule-time';

describe('isValidTime', () => {
  it('HH:mm 24시간 형식만 허용한다', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('08:30')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('08:60')).toBe(false);
    expect(isValidTime('8:30')).toBe(false);
    expect(isValidTime('')).toBe(false);
  });
});

describe('shiftTime', () => {
  it('분 단위로 더하고 뺀다', () => {
    expect(shiftTime('08:00', 30)).toBe('08:30');
    expect(shiftTime('08:30', -30)).toBe('08:00');
    expect(shiftTime('08:45', 30)).toBe('09:15');
  });

  it('자정을 넘으면 24시간 안에서 순환한다', () => {
    expect(shiftTime('23:50', 30)).toBe('00:20');
    expect(shiftTime('00:10', -30)).toBe('23:40');
  });

  it('잘못된 입력은 그대로 반환한다', () => {
    expect(shiftTime('bad', 30)).toBe('bad');
  });
});

describe('formatTimeLabel', () => {
  it('오전/오후 12시간제로 표시한다', () => {
    expect(formatTimeLabel('08:30')).toBe('오전 8:30');
    expect(formatTimeLabel('12:00')).toBe('오후 12:00');
    expect(formatTimeLabel('19:05')).toBe('오후 7:05');
    expect(formatTimeLabel('00:15')).toBe('오전 12:15');
  });
});
