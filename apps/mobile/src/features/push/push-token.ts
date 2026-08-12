import Constants from 'expo-constants';

/**
 * Expo 푸시 토큰 발급에는 EAS projectId가 필요하다.
 * app.json의 extra.eas.projectId에 들어 있고, 빌드 방식에 따라 easConfig로도 노출된다.
 */
export function resolveProjectId(
  config: {
    expoConfig?: { extra?: { eas?: { projectId?: string } } } | null;
    easConfig?: { projectId?: string } | null;
  } = Constants,
): string | null {
  return (
    config.expoConfig?.extra?.eas?.projectId ??
    config.easConfig?.projectId ??
    null
  );
}
