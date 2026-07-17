import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma';
import { submitPick, getReconciliation } from './draft-room.service';
import { DraftError } from './draft-room.errors';
import { createTestDraft, cleanupDraft } from './test-helpers';

/**
 * Integration tests against the real local Postgres/Redis (docker-compose)
 * rather than mocks, since the behavior under test - the transactional row
 * lock serializing concurrent writes - only actually exists at the database
 * level (tasks.md #4.6/#4.7, Req 3.3/3.8).
 */
describe('draft-room concurrency', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('serializes two simultaneous submissions for the same player - only one succeeds', async () => {
    const { draftId, leagueId, order } = await createTestDraft();
    const onTheClockTeamId = order[0];

    try {
      const attempt = () =>
        submitPick({
          draftId,
          teamId: onTheClockTeamId,
          playerId: 'player-contested',
          lastKnownPickIndex: 0,
        });

      const results = await Promise.allSettled([attempt(), attempt()]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejection = rejected[0] as PromiseRejectedResult;
      expect(rejection.reason).toBeInstanceOf(DraftError);
      expect((rejection.reason as DraftError).code).toBe('PICK_ALREADY_TAKEN');

      // Confirm the draft only actually advanced by one pick, not two -
      // this is the real assertion that the lock prevented a double-write,
      // not just that one HTTP-level call happened to error.
      const finalDraft = await prisma.draft.findUniqueOrThrow({ where: { id: draftId } });
      expect(finalDraft.currentPickIndex).toBe(1);

      const picks = await prisma.pick.findMany({ where: { draftId } });
      expect(picks).toHaveLength(1);
      expect(picks[0].playerId).toBe('player-contested');
    } finally {
      await cleanupDraft(draftId, leagueId);
    }
  });

  it('rejects a pick from a team that is not on the clock', async () => {
    const { draftId, leagueId, order } = await createTestDraft();
    const notOnClockTeamId = order[1];

    try {
      await expect(
        submitPick({
          draftId,
          teamId: notOnClockTeamId,
          playerId: 'player-x',
          lastKnownPickIndex: 0,
        }),
      ).rejects.toMatchObject({ code: 'NOT_YOUR_TURN' });

      const picks = await prisma.pick.findMany({ where: { draftId } });
      expect(picks).toHaveLength(0);
    } finally {
      await cleanupDraft(draftId, leagueId);
    }
  });
});

describe('draft-room reconnect/reconciliation', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns full snapshot plus only picks after lastKnownPickIndex', async () => {
    const { draftId, leagueId, order } = await createTestDraft();

    try {
      await submitPick({
        draftId,
        teamId: order[0],
        playerId: 'player-1',
        lastKnownPickIndex: 0,
      });
      await submitPick({
        draftId,
        teamId: order[1],
        playerId: 'player-2',
        lastKnownPickIndex: 1,
      });

      const { snapshot, delta } = await getReconciliation(draftId, 1);

      // Full snapshot always contains everything, regardless of what the
      // client already knew about.
      expect(snapshot.picks).toHaveLength(2);
      expect(snapshot.draft.currentPickIndex).toBe(2);

      // Delta only contains picks the reconnecting client hadn't seen yet.
      expect(delta).toHaveLength(1);
      expect(delta[0].playerId).toBe('player-2');
    } finally {
      await cleanupDraft(draftId, leagueId);
    }
  });

  it('completes the draft once every pick slot is filled', async () => {
    const { draftId, leagueId, order } = await createTestDraft({ order: ['team-a', 'team-b'] });

    try {
      await submitPick({ draftId, teamId: order[0], playerId: 'p1', lastKnownPickIndex: 0 });
      const result = await submitPick({
        draftId,
        teamId: order[1],
        playerId: 'p2',
        lastKnownPickIndex: 1,
      });

      expect(result.isDraftComplete).toBe(true);
      expect(result.snapshot.draft.status).toBe('completed');
    } finally {
      await cleanupDraft(draftId, leagueId);
    }
  });
});

describe('draft-room stale turn protection', () => {
  it('rejects a stale expected pick index even when the same team owns consecutive slots', async () => {
    const { draftId, leagueId } = await createTestDraft({ order: ['team-a', 'team-a'] });

    try {
      await submitPick({
        draftId,
        teamId: 'team-a',
        playerId: 'first-player',
        lastKnownPickIndex: 0,
      });

      await expect(
        submitPick({
          draftId,
          teamId: 'team-a',
          playerId: 'stale-second-player',
          lastKnownPickIndex: 0,
        }),
      ).rejects.toMatchObject({ code: 'NOT_YOUR_TURN' });

      const draft = await prisma.draft.findUniqueOrThrow({ where: { id: draftId } });
      expect(draft.currentPickIndex).toBe(1);
    } finally {
      await cleanupDraft(draftId, leagueId);
    }
  });
});
