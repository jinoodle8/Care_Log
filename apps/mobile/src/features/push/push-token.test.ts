import { resolveProjectId } from './push-token';

describe('resolveProjectId', () => {
  it('expoConfig.extra.eas.projectId를 우선 사용한다', () => {
    expect(
      resolveProjectId({
        expoConfig: { extra: { eas: { projectId: 'from-expo-config' } } },
        easConfig: { projectId: 'from-eas-config' },
      }),
    ).toBe('from-expo-config');
  });

  it('expoConfig에 없으면 easConfig를 본다', () => {
    expect(
      resolveProjectId({ expoConfig: null, easConfig: { projectId: 'fallback' } }),
    ).toBe('fallback');
  });

  it('둘 다 없으면 null을 반환한다', () => {
    expect(resolveProjectId({ expoConfig: null, easConfig: null })).toBeNull();
    expect(resolveProjectId({})).toBeNull();
    expect(resolveProjectId({ expoConfig: { extra: {} } })).toBeNull();
  });
});
