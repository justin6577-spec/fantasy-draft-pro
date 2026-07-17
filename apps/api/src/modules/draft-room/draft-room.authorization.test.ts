import { randomUUID } from 'node:crypto';
import { type AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { buildApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { registerDraftRoomGateway } from './draft-room.gateway';

const app = buildApp();
let baseUrl = '';
const sockets: Socket[] = [];
const userIds: string[] = [];
let leagueId = '';
let draftId = '';

async function signup(label: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { email: `${label}-${randomUUID()}@draft-auth.test`, password: 'Correct-Horse-42!' },
  });
  expect(response.statusCode).toBe(201);
  const body = response.json();
  userIds.push(body.user.id);
  return body as { accessToken: string; user: { id: string; email: string } };
}

function client(accessToken?: string): Socket {
  const socket = io(baseUrl, {
    path: '/ws/draft',
    transports: ['websocket'],
    auth: accessToken ? { token: accessToken } : {},
    autoConnect: false,
    reconnection: false,
  });
  sockets.push(socket);
  return socket;
}

function nextEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 3000);
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  registerDraftRoomGateway(app);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  if (draftId) {
    await prisma.pick.deleteMany({ where: { draftId } });
    await prisma.draft.deleteMany({ where: { id: draftId } });
    await redis.del(`draft:${draftId}:clock`);
  }
  if (leagueId) await prisma.league.deleteMany({ where: { id: leagueId } });
  if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await app.close();
  await prisma.$disconnect();
});

describe('authenticated draft authorization', () => {
  it('rejects unauthenticated sockets and derives pick team ownership from the authenticated user', async () => {
    const first = await signup('first');
    const second = await signup('second');
    const outsider = await signup('outsider');

    const league = await prisma.league.create({
      data: {
        name: 'Authorized Draft Test',
        platform: 'native',
        seasonId: '2026',
        scoringSettings: { type: 'ppr' },
        rosterSettings: { qb: 1, rb: 2, wr: 2, te: 1, flex: 1, k: 1, dst: 1, bench: 6 },
      },
    });
    leagueId = league.id;

    const created = await app.inject({
      method: 'POST',
      url: '/drafts',
      headers: { authorization: `Bearer ${first.accessToken}` },
      payload: {
        leagueId,
        order: ['team-a', 'team-b'],
        participants: [
          { userId: first.user.id, teamId: 'team-a' },
          { userId: second.user.id, teamId: 'team-b' },
        ],
        settings: { pickClockSeconds: 30, autoPickOnExpiry: false, rounds: 1 },
      },
    });
    expect(created.statusCode).toBe(201);
    draftId = created.json().id;

    const noAuth = await app.inject({ method: 'GET', url: `/drafts/${draftId}` });
    expect(noAuth.statusCode).toBe(401);

    const outsiderRead = await app.inject({
      method: 'GET',
      url: `/drafts/${draftId}`,
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(outsiderRead.statusCode).toBe(403);

    const participantRead = await app.inject({
      method: 'GET',
      url: `/drafts/${draftId}`,
      headers: { authorization: `Bearer ${first.accessToken}` },
    });
    expect(participantRead.statusCode).toBe(200);

    const anonymousSocket = client();
    const anonymousError = nextEvent<Error>(anonymousSocket, 'connect_error');
    anonymousSocket.connect();
    expect((await anonymousError).message).toBe('unauthorized');

    const outsiderSocket = client(outsider.accessToken);
    await new Promise<void>((resolve, reject) => {
      outsiderSocket.once('connect', resolve);
      outsiderSocket.once('connect_error', reject);
      outsiderSocket.connect();
    });
    const denied = nextEvent<{ error: string }>(outsiderSocket, 'draft.access_denied');
    outsiderSocket.emit('join', { draftId, lastKnownPickIndex: -1 });
    expect((await denied).error).toBe('draft_access_denied');

    const firstSocket = client(first.accessToken);
    await new Promise<void>((resolve, reject) => {
      firstSocket.once('connect', resolve);
      firstSocket.once('connect_error', reject);
      firstSocket.connect();
    });
    const identity = nextEvent<{ teamId: string }>(firstSocket, 'draft.identity');
    firstSocket.emit('join', { draftId, lastKnownPickIndex: -1 });
    expect((await identity).teamId).toBe('team-a');

    const pickMade = nextEvent<{ pick: { teamId: string; playerId: string } }>(firstSocket, 'pick.made');
    firstSocket.emit('pick.submit', {
      draftId,
      playerId: 'authorized-player-1',
      lastKnownPickIndex: 0,
      teamId: 'team-b', // ignored: server uses DraftParticipant(team-a)
    });
    expect((await pickMade).pick).toMatchObject({
      teamId: 'team-a',
      playerId: 'authorized-player-1',
    });
  });
});
