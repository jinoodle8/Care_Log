import type { Schedule } from '@carelog/shared';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { buildNotificationPlan } from './notification-plan';

/** 앱이 열려 있어도 알림이 보이도록 한다(어르신이 화면을 켜둔 채 기다릴 수 있음). */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * 어르신 기기의 복약 알림을 스케줄과 일치시킨다.
 * 기존 예약을 모두 지우고 다시 등록해, 보호자가 스케줄을 바꾸면 다음 알림부터 반영된다(PRD 4.2.5).
 * 반환값은 등록된 알림 개수.
 */
export async function syncMedicationReminders(schedules: Schedule[]): Promise<number> {
  if (!(await ensureNotificationPermission())) return 0;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication', {
      name: '복약 알림',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const plan = buildNotificationPlan(schedules);
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        data: { type: 'schedule.reminder', slot: item.slot },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: item.hour,
        minute: item.minute,
        channelId: Platform.OS === 'android' ? 'medication' : undefined,
      },
    });
  }
  return plan.length;
}
