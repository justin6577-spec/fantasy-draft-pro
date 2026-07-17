import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import type {
  ClockTickEvent,
  DraftCompletedEvent,
  PickMadeEvent,
  PickRejectedEvent,
  PickSubmitRequest,
  TurnChangedEvent,
} from '@fantasy-draft/shared';
import { autoPickOrSkip, getReconciliation, submitPick } from './draft-room.service';
import { getRemainingSeconds, isExpired } from './draft-clock';
import { DraftError } from './draft-room.errors';
import { DraftAccessError, requireDraftParticipant } from './draft-access';

interface JoinPayload {
  draftId: string;
  lastKnownPickIndex?: number;
}

const roomFor = (draftId: string): string => `draft:${draftId}`;
const activeTickers = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Authenticated Socket.IO gateway. The access token is verified during the
 * handshake; every join and pick re-checks DraftParticipant membership.
 * teamId is never accepted from the client and is derived server-side.
 */
export function registerDraftRoomGateway(app: FastifyInstance): SocketIOServer {
  const io = new SocketIOServer(app.server, {
    path: '/ws/draft',
    cors: { origin: '*' }, // tighten to configured app/web origins before production
  });

  io.use((socket, next) => {
    const token = extractAccessToken(socket);
    if (!token) return next(new Error('unauthorized'));

    try {
      const claims = app.jwt.verify<{ sub: string; email: string; type: 'access' }>(token);
      if (claims.type !== 'access') return next(new Error('unauthorized'));
      socket.data.userId = claims.sub;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join', async (payload: JoinPayload) => {
      try {
        const { draftId, lastKnownPickIndex = -1 } = payload;
        const teamId = await requireDraftParticipant(draftId, socket.data.userId as string);
        const { snapshot, delta } = await getReconciliation(draftId, lastKnownPickIndex);

        await socket.join(roomFor(draftId));
        socket.emit('draft.identity', { draftId, teamId });
        socket.emit('snapshot', snapshot);
        if (delta.length > 0) socket.emit('delta', delta);

        ensureTicker(io, draftId);
      } catch (error) {
        handleAccessError(socket, error);
      }
    });

    socket.on('pick.submit', async (payload: PickSubmitRequest) => {
      const { draftId, playerId, lastKnownPickIndex } = payload;
      try {
        const teamId = await requireDraftParticipant(draftId, socket.data.userId as string);
        const result = await submitPick({ draftId, teamId, playerId, lastKnownPickIndex });
        broadcastPickResult(io, draftId, result);
      } catch (error) {
        await handlePickError(socket, draftId, error);
      }
    });
  });

  app.addHook('onClose', () => {
    for (const draftId of activeTickers.keys()) stopTicker(draftId);
    io.close();
  });

  return io;
}

function extractAccessToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) return authToken;

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function handleAccessError(socket: Socket, error: unknown): void {
  if (error instanceof DraftAccessError) {
    socket.emit('draft.access_denied', { error: 'draft_access_denied', message: error.message });
    return;
  }
  socket.emit('error', { message: (error as Error).message });
}

async function handlePickError(socket: Socket, draftId: string, error: unknown): Promise<void> {
  if (error instanceof DraftAccessError) {
    handleAccessError(socket, error);
    return;
  }

  if (error instanceof DraftError && error.code !== 'DRAFT_NOT_FOUND') {
    const rejection: PickRejectedEvent = {
      type: 'pick.rejected',
      draftId,
      reason:
        error.code === 'DRAFT_NOT_IN_PROGRESS'
          ? 'INVALID_PLAYER'
          : error.code,
      snapshot: (await getReconciliation(draftId, 0)).snapshot,
    };
    socket.emit('pick.rejected', rejection);
    return;
  }

  socket.emit('error', { message: (error as Error).message });
}

function broadcastPickResult(
  io: SocketIOServer,
  draftId: string,
  result: {
    pick: PickMadeEvent['pick'];
    snapshot: {
      draft: { currentPickIndex: number; clockSecondsRemaining: number; order: string[] };
    };
    isDraftComplete: boolean;
  },
): void {
  const pickMade: PickMadeEvent = { type: 'pick.made', draftId, pick: result.pick };
  io.to(roomFor(draftId)).emit('pick.made', pickMade);

  if (result.isDraftComplete) {
    const completed: DraftCompletedEvent = { type: 'draft.completed', draftId };
    io.to(roomFor(draftId)).emit('draft.completed', completed);
    stopTicker(draftId);
    return;
  }

  const { draft } = result.snapshot;
  const turnChanged: TurnChangedEvent = {
    type: 'turn.changed',
    draftId,
    currentPickIndex: draft.currentPickIndex,
    onTheClockTeamId: draft.order[draft.currentPickIndex],
    clockSecondsRemaining: draft.clockSecondsRemaining,
  };
  io.to(roomFor(draftId)).emit('turn.changed', turnChanged);
}

function ensureTicker(io: SocketIOServer, draftId: string): void {
  if (activeTickers.has(draftId)) return;

  const interval = setInterval(async () => {
    try {
      const remaining = await getRemainingSeconds(draftId);
      if (remaining === null) return;

      const tick: ClockTickEvent = { type: 'clock.tick', draftId, clockSecondsRemaining: remaining };
      io.to(roomFor(draftId)).emit('clock.tick', tick);

      if (await isExpired(draftId)) {
        const result = await autoPickOrSkip(draftId);
        broadcastPickResult(io, draftId, result);
      }
    } catch {
      // Transient DB/Redis failures are retried on the next tick.
    }
  }, 1000);

  activeTickers.set(draftId, interval);
}

function stopTicker(draftId: string): void {
  const interval = activeTickers.get(draftId);
  if (interval) {
    clearInterval(interval);
    activeTickers.delete(draftId);
  }
}
