import { io, type Socket } from 'socket.io-client';
import { authSession } from '@/auth/session';
import { API_URL } from '@/config/api';

export interface AuthenticatedDraftSocket {
  socket: Socket;
  dispose(): void;
}

/** Creates an unconnected socket with current JWT auth and one forced retry. */
export async function createAuthenticatedDraftSocket(): Promise<AuthenticatedDraftSocket> {
  const accessToken = await authSession.getValidAccessToken();
  const socket = io(API_URL, {
    path: '/ws/draft',
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    auth: { token: accessToken },
  });

  let unauthorizedRetryUsed = false;
  let disposed = false;

  const updateSocketToken = async () => {
    try {
      const token = await authSession.getValidAccessToken();
      socket.auth = { token };
    } catch {
      socket.disconnect();
    }
  };

  const unsubscribe = authSession.subscribe(() => {
    if (authSession.getState().status === 'authenticated') void updateSocketToken();
  });

  socket.on('connect', () => {
    unauthorizedRetryUsed = false;
  });

  socket.on('connect_error', async (error: Error) => {
    if (disposed || error.message !== 'unauthorized' || unauthorizedRetryUsed) return;
    unauthorizedRetryUsed = true;
    try {
      const token = await authSession.getValidAccessToken(true);
      socket.auth = { token };
      socket.connect();
    } catch {
      socket.disconnect();
    }
  });

  socket.io.on('reconnect_attempt', () => {
    void updateSocketToken();
  });

  return {
    socket,
    dispose() {
      disposed = true;
      unsubscribe();
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
    },
  };
}
