import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_RECOGNITION_SETTINGS,
  RECOGNITION_SETTINGS_STORAGE_KEY,
  useRecognitionSettingsStore,
} from './recognition-settings-store';

describe('useRecognitionSettingsStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useRecognitionSettingsStore.setState({ ...DEFAULT_RECOGNITION_SETTINGS, isLoaded: false });
  });

  it('저장된 값이 없으면 기본값을 로드한다', async () => {
    await useRecognitionSettingsStore.getState().load();
    const state = useRecognitionSettingsStore.getState();
    expect(state.demoMode).toBe(false);
    expect(state.isLoaded).toBe(true);
  });

  it('setDemoMode로 값을 바꾸면 AsyncStorage에 영속화된다', async () => {
    await useRecognitionSettingsStore.getState().setDemoMode(true);
    expect(useRecognitionSettingsStore.getState().demoMode).toBe(true);

    const raw = await AsyncStorage.getItem(RECOGNITION_SETTINGS_STORAGE_KEY);
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ demoMode: true });
  });

  it('재로드 시 이전에 저장한 데모 모드 값을 그대로 복원한다', async () => {
    await useRecognitionSettingsStore.getState().setDemoMode(true);
    useRecognitionSettingsStore.setState({ ...DEFAULT_RECOGNITION_SETTINGS, isLoaded: false });

    await useRecognitionSettingsStore.getState().load();
    expect(useRecognitionSettingsStore.getState().demoMode).toBe(true);
  });

  it('setTakenRate/setUncertainRate로 확률값을 조정할 수 있다', async () => {
    await useRecognitionSettingsStore.getState().setTakenRate(0.7);
    await useRecognitionSettingsStore.getState().setUncertainRate(0.2);

    const state = useRecognitionSettingsStore.getState();
    expect(state.takenRate).toBe(0.7);
    expect(state.uncertainRate).toBe(0.2);
  });
});
