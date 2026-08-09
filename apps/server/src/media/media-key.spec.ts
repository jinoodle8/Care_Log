import { buildVideoKey, parseVideoRef, toVideoRef } from './media-key';

describe('media-key', () => {
  describe('buildVideoKey', () => {
    it('날짜 프리픽스와 확장자를 붙인 키를 만든다', () => {
      const key = buildVideoKey('video/mp4', new Date(2026, 5, 12, 8, 47));
      expect(key).toMatch(/^2026\/06\/12\/[0-9a-f]{32}\.mp4$/);
    });

    it('quicktime은 mov 확장자를 쓴다', () => {
      const key = buildVideoKey('video/quicktime', new Date(2026, 0, 3));
      expect(key).toMatch(/^2026\/01\/03\/[0-9a-f]{32}\.mov$/);
    });

    it('같은 시각에도 매번 다른 키를 만든다(추측 불가)', () => {
      const now = new Date(2026, 5, 12);
      const keys = new Set(
        Array.from({ length: 100 }, () => buildVideoKey('video/mp4', now)),
      );
      expect(keys.size).toBe(100);
    });
  });

  describe('toVideoRef / parseVideoRef', () => {
    it('s3:// 참조로 변환하고 되돌린다', () => {
      const ref = toVideoRef('carelog-vault', '2026/06/12/abc.mp4');
      expect(ref).toBe('s3://carelog-vault/2026/06/12/abc.mp4');
      expect(parseVideoRef(ref)).toEqual({
        bucket: 'carelog-vault',
        key: '2026/06/12/abc.mp4',
      });
    });

    it('형식이 다르면 null을 반환한다', () => {
      expect(parseVideoRef('https://example.com/a.mp4')).toBeNull();
      expect(parseVideoRef('s3://bucket-only')).toBeNull();
      expect(parseVideoRef('')).toBeNull();
    });
  });
});
