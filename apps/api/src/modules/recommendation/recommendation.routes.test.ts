import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RecommendationResponse } from '@fantasy-draft/shared';
import { buildApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';

const app = buildApp();
const userIds: string[] = [];
const playerIds: string[] = [];
let leagueId = '';
let draftId = '';
let participantToken = '';
let outsiderToken = '';

async function signup(label: string): Promise<{ accessToken: string; userId: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email: `${label}-${randomUUID()}@recommendations.test`,
      password: 'Correct-Horse-42!',
    },
  });
  expect(response.statusCode).toBe(201);
  const body = response.json() as { accessToken: string; user: { id: string } };
  userIds.push(body.user.id);
  return { accessToken: body.accessToken, userId: body.user.id };
}

beforeAll(async () => {
  await app.ready();
  const participant = await signup('participant');
  const outsider = await signup('outsider');
  participantToken = participant.accessToken;
  outsiderToken = outsider.accessToken;

  const league = await prisma.league.create({
    data: {
      name: 'Recommendation Route Test',
      platform: 'sleeper',
      seasonId: '2026-recommendations',
      scoringSettings: { type: 'ppr' },
      rosterSettings: { qb: 1, rb: 1, wr: 1, te: 1, flex: 0, k: 0, dst: 0, bench: 2 },
    },
  });
  leagueId = league.id;
  const draft = await prisma.draft.create({
    data: {
      leagueId,
      order: ['team-b', 'team-a'],
      currentPickIndex: 1,
      clockSecondsRemaining: 30,
      status: 'in_progress',
      settings: { pickClockSeconds: 30, autoPickOnExpiry: true, rounds: 1 },
      participants: { create: { userId: participant.userId, teamId: 'team-a' } },
    },
  });
  draftId = draft.id;

  const draftedExternalId = `sleeper-${randomUUID()}`;
  const players = [
    {
      id: `drafted-${randomUUID()}`,
      name: 'Already Drafted',
      position: 'RB',
      team: 'AAA',
      externalIds: { sleeper: draftedExternalId },
    },
    { id: `available-${randomUUID()}`, name: 'Still Available', position: 'WR', team: 'BBB' },
  ];
  playerIds.push(...players.map((player) => player.id));
  await prisma.player.createMany({ data: players });
  await prisma.projectionRanking.createMany({
    data: [
      { playerId: players[0].id, seasonId: league.seasonId, scoringType: 'ppr', rank: 1, projectedPoints: 300 },
      { playerId: players[1].id, seasonId: league.seasonId, scoringType: 'ppr', rank: 2, projectedPoints: 250 },
    ],
  });
  await prisma.pick.create({
    data: { draftId, pickIndex: 0, teamId: 'team-b', playerId: draftedExternalId, source: 'manual' },
  });
});

afterAll(async () => {
  if (draftId) {
    const cacheKeys = await redis.keys(`recommendations:v2:${draftId}:*`);
    if (cacheKeys.length > 0) await redis.del(...cacheKeys);
    await prisma.pick.deleteMany({ where: { draftId } });
    await prisma.draft.deleteMany({ where: { id: draftId } });
  }
  if (leagueId) await prisma.league.deleteMany({ where: { id: leagueId } });
  if (playerIds.length > 0) {
    await prisma.projectionRanking.deleteMany({ where: { playerId: { in: playerIds } } });
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
  }
  if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await app.close();
  await prisma.$disconnect();
});

describe('recommendation route authorization and cache', () => {
  it('requires access auth and draft membership, derives state server-side, and caches the response', async () => {
    const url = `/drafts/${draftId}/recommendations`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url,
          headers: { authorization: `Bearer ${outsiderToken}` },
        })
      ).statusCode,
    ).toBe(403);

    const authorized = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${participantToken}` },
    });
    expect(authorized.statusCode).toBe(200);
    const response = authorized.json() as RecommendationResponse;
    expect(response.pickIndex).toBe(1);
    expect(response.candidates.map((candidate) => candidate.playerName)).toEqual(['Still Available']);
    expect(response.reasoning[0]?.playerId).toBe(response.candidates[0]?.playerId);
    expect(response.degraded).toBe(true);

    const cacheKeys = await redis.keys(`recommendations:v2:${draftId}:team-a:*`);
    expect(cacheKeys).toHaveLength(1);
    expect(await redis.ttl(cacheKeys[0])).toBeGreaterThan(0);

    const cached = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${participantToken}` },
    });
    expect(cached.json()).toEqual(response);
  });
});
