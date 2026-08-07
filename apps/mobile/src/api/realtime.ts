import type { MedicationLog } from '@carelog/shared';
import { io, type Socket } from 'socket.io-client';

const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'http://localhost:3000';

export interface RealtimeSubscription {
  close: () => void;
}

/** 어르신 room을 구독해 log.created / log.updated 이벤트를 수신한다(TRD 5.3).
 * 연결/구독 실패는 화면을 막지 않도록 onError로만 알린다. */
export function subscribeToElderLogs(params: {
  accessToken: string;
  elderId: string;
  onLogCreated: (log: MedicationLog) => void;
  /** 수동확인 등으로 기존 기록이 바뀐 경우(M3-12) */
  onLogUpdated?: (log: MedicationLog) => void;
  onError?: (message: string) => void;
}): RealtimeSubscription {
  const socket: Socket = io(`${WS_URL}/realtime`, {
    transports: ['websocket'],
    auth: { token: params.accessToken },
  });

  socket.on('connect', () => {
    socket
      .emitWithAck('subscribe', { elderId: params.elderId })
      .then((ack: { ok: boolean; code?: string }) => {
        if (!ack?.ok) {
          params.onError?.(ack?.code ?? 'SUBSCRIBE_FAILED');
        }
      })
      .catch(() => params.onError?.('SUBSCRIBE_FAILED'));
  });

  socket.on('log.created', (log: MedicationLog) => {
    params.onLogCreated(log);
  });

  socket.on('log.updated', (log: MedicationLog) => {
    params.onLogUpdated?.(log);
  });

  socket.on('connect_error', () => params.onError?.('CONNECT_ERROR'));

  return {
    close: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
