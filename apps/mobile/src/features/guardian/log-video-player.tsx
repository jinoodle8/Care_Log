import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ApiError } from '@/api/client';
import { fetchLogVideoUrl } from '@/api/logs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface Props {
  logId: string;
}

/**
 * 판정 근거 영상 재생(M4-05). 버킷은 퍼블릭 차단이라 재생 직전에 presigned GET URL을
 * 받아 와야 하고, URL이 짧게 만료되므로 미리 받아두지 않고 "영상 보기"를 누를 때 요청한다.
 */
export function LogVideoPlayer({ logId }: Props) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const player = useVideoPlayer(sourceUrl, (instance) => {
    instance.loop = false;
  });

  const handleOpen = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { url } = await fetchLogVideoUrl(logId);
      setSourceUrl(url);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : '영상을 불러오지 못했어요.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [logId]);

  if (sourceUrl) {
    return (
      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain"
        nativeControls
      />
    );
  }

  return (
    <ThemedView style={styles.wrapper}>
      <Pressable
        style={styles.openButton}
        disabled={isLoading}
        onPress={() => void handleOpen()}
      >
        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <ThemedText type="smallBold">영상 보기</ThemedText>
        )}
      </Pressable>
      {errorMessage ? (
        <ThemedText type="small" style={styles.errorText}>
          {errorMessage}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  openButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  video: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  errorText: {
    color: '#DC2626',
  },
});
