import { buildCorsOptions, parseOrigins } from './cors';

describe('parseOrigins', () => {
  it('쉼표로 나누고 공백을 제거한다', () => {
    expect(parseOrigins('https://a.com, https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('비어 있으면 빈 배열을 반환한다', () => {
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins('')).toEqual([]);
    expect(parseOrigins(' , ')).toEqual([]);
  });
});

describe('buildCorsOptions', () => {
  it('개발 환경에서는 화이트리스트가 없으면 전체 허용', () => {
    expect(buildCorsOptions('development', undefined)).toEqual({
      origin: true,
      credentials: true,
    });
  });

  it('개발 환경에서도 화이트리스트가 있으면 존중한다', () => {
    expect(buildCorsOptions('development', 'http://localhost:8081')).toEqual({
      origin: ['http://localhost:8081'],
      credentials: true,
    });
  });

  it('운영 환경에서는 화이트리스트만 허용한다', () => {
    expect(buildCorsOptions('production', 'https://app.carelog.kr')).toEqual({
      origin: ['https://app.carelog.kr'],
      credentials: true,
    });
  });

  it('운영 환경에서 화이트리스트가 없으면 부팅을 막는다', () => {
    expect(() => buildCorsOptions('production', undefined)).toThrow(
      /CORS_ALLOWED_ORIGINS/,
    );
  });
});
