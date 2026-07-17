import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import type { DraftSettings } from '@fantasy-draft/shared';

/**
 * Shared setup for draft-room integration tests. Creates a real League +
 * Draft row against the local Postgres instance (docker-compose), since
 * the concurrency guarantee we're testing lives in a real DB transaction/
 * row lock - a mocked Prisma client would not exercise that behavior.
 */
export async function createTestDraft(overrides?: {
  order?: string[];
  settings?: Partial<DraftSettings>;
}): Promise<{ draftId: string; leagueId: string; order: string[] }> {
  const league = await prisma.league.create({
    data: {
      name: `Test League ${randomUUID()}`,
      platform: 'native',
      seasonId: '2026',
      scoringSettings: { type: 'ppr' },
      rosterSettings: {
        qb: 1,
        rb: 2,
        wr: 2,
        te: 1,
        flex: 1,
        k: 1,
        dst: 1,
        bench: 6,
      },
    },
  });

  const order = overrides?.order ?? ['team-a', 'team-b'];
  const settings: DraftSettings = {
    pickClockSeconds: 30,
    autoPickOnExpiry: false,
    rounds: 1,
    ...overrides?.settings,
  };

  const draft = await prisma.draft.create({
    data: {
      leagueId: league.id,
      order,
      currentPickIndex: 0,
      clockSecondsRemaining: settings.pickClockSeconds,
      status: 'in_progress',
      settings: settings as unknown as object,
    },
  });

  return { draftId: draft.id, leagueId: league.id, order };
}

export async function cleanupDraft(draftId: string, leagueId: string): Promise<void> {
  await prisma.pick.deleteMany({ where: { draftId } });
  await prisma.draft.deleteMany({ where: { id: draftId } });
  await prisma.league.deleteMany({ where: { id: leagueId } });
  await redis.del(`draft:${draftId}:clock`);
}
