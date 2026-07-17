import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { createAndStartDraft } from '../draft-room/draft-room.admin';
import { submitPick } from '../draft-room/draft-room.service';
import type { ExpoPushMessage } from './expo-push.client';
import {
  enqueueTurnNotification,
  processTurnNotificationOutbox,
} from './turn-notification.service';

interface Fixture {
  draftId: string;
  leagueId: string;
  firstUserId: string;
  secondUserId: string;
}

async function createFixture(): Promise<Fixture> {
  const [first, second] = await Promise.all([
    prisma.user.create({ data: { email: `first-${randomUUID()}@push.test` } }),
    prisma.user.create({ data: { email: `second-${randomUUID()}@push.test` } }),
  ]);
  const league = await prisma.league.create({
    data: {
      name: 'Push Test League',
      platform: 'native',
      seasonId: '2026',
      scoringSettings: { type: 'ppr' },
      rosterSettings: { rounds: 1 },
    },
  });
  const draft = await createAndStartDraft({
    leagueId: league.id,
    order: ['team-a', 'team-b'],
    participants: [
      { userId: first.id, teamId: 'team-a' },
      { userId: second.id, teamId: 'team-b' },
    ],
    settings: { pickClockSeconds: 30, autoPickOnExpiry: false, rounds: 1 },
    creatorUserId: first.id,
  });
  return {
    draftId: draft.id,
    leagueId: league.id,
    firstUserId: first.id,
    secondUserId: second.id,
  };
}

async function cleanup(fixture: Fixture): Promise<void> {
  await prisma.pick.deleteMany({ where: { draftId: fixture.draftId } });
  await prisma.draft.delete({ where: { id: fixture.draftId } });
  await prisma.league.delete({ where: { id: fixture.leagueId } });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.firstUserId, fixture.secondUserId] } },
  });
  await redis.del(`draft:${fixture.draftId}:clock`);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('turn notification outbox', () => {
  it('enqueues the initial turn once and delivers a high-priority draft payload', async () => {
    const fixture = await createFixture();
    try {
      const initial = await prisma.turnNotificationOutbox.findUniqueOrThrow({
        where: {
          draftId_pickIndex_userId: {
            draftId: fixture.draftId,
            pickIndex: 0,
            userId: fixture.firstUserId,
          },
        },
      });
      await prisma.$transaction((tx) =>
        enqueueTurnNotification(tx, {
          draftId: fixture.draftId,
          pickIndex: 0,
          teamId: 'team-a',
          clockSeconds: 30,
        }),
      );
      expect(
        await prisma.turnNotificationOutbox.count({
          where: { draftId: fixture.draftId, pickIndex: 0 },
        }),
      ).toBe(1);

      await prisma.pushToken.create({
        data: {
          userId: fixture.firstUserId,
          token: `ExpoPushToken[${randomUUID()}]`,
          installationId: `installation-${randomUUID()}`,
          platform: 'android',
        },
      });
      const sender = vi.fn(async (_messages: ExpoPushMessage[]) => [
        { status: 'ok' as const, id: 'expo-ticket-1' },
      ]);
      await processTurnNotificationOutbox({ sender });

      expect(sender).toHaveBeenCalledOnce();
      expect(sender.mock.calls[0]?.[0]?.[0]).toMatchObject({
        title: "You're on the clock",
        priority: 'high',
        channelId: 'draft-turns',
        data: {
          type: 'draft.on_the_clock',
          draftId: fixture.draftId,
          pickIndex: 0,
        },
      });
      await expect(
        prisma.turnNotificationOutbox.findUniqueOrThrow({ where: { id: initial.id } }),
      ).resolves.toMatchObject({ status: 'sent', expoTicketIds: ['expo-ticket-1'] });
    } finally {
      await cleanup(fixture);
    }
  });

  it('enqueues the next participant after a pick and disables an unregistered device token', async () => {
    const fixture = await createFixture();
    try {
      await prisma.pushToken.create({
        data: {
          userId: fixture.secondUserId,
          token: `ExpoPushToken[${randomUUID()}]`,
          installationId: `installation-${randomUUID()}`,
          platform: 'ios',
        },
      });
      await submitPick({
        draftId: fixture.draftId,
        teamId: 'team-a',
        playerId: 'push-test-player',
        lastKnownPickIndex: 0,
      });

      const next = await prisma.turnNotificationOutbox.findUniqueOrThrow({
        where: {
          draftId_pickIndex_userId: {
            draftId: fixture.draftId,
            pickIndex: 1,
            userId: fixture.secondUserId,
          },
        },
      });
      const sender = vi.fn(async (_messages: ExpoPushMessage[]) => [
        {
          status: 'error' as const,
          message: 'Device is no longer registered',
          details: { error: 'DeviceNotRegistered' },
        },
      ]);
      await processTurnNotificationOutbox({ sender });

      expect(sender).toHaveBeenCalled();
      await expect(
        prisma.pushToken.findFirstOrThrow({ where: { userId: fixture.secondUserId } }),
      ).resolves.toMatchObject({ enabled: false });
      await expect(
        prisma.turnNotificationOutbox.findUniqueOrThrow({ where: { id: next.id } }),
      ).resolves.toMatchObject({ status: 'failed', attempts: 1 });
    } finally {
      await cleanup(fixture);
    }
  });
});
