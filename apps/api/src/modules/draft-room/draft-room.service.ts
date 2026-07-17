import type { DraftStateSnapshot } from '@fantasy-draft/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { toDraft, toPick } from './draft-room.mapper';
import { DraftError } from './draft-room.errors';
import { clearClock, startClock } from './draft-clock';
import { getDeterministicCandidates } from '../recommendation/recommendation.service';
import { enqueueTurnNotification } from '../notification/turn-notification.service';

/**
 * Draft Room Service - authoritative state machine for native drafts
 * (design.md "1. Draft Room Service"). The server never trusts client-side
 * "whose turn is it" logic; every transition happens here, inside a
 * transaction that locks the Draft row.
 */

export interface SubmitPickInput {
  draftId: string;
  teamId: string;
  playerId: string;
  lastKnownPickIndex: number;
}

export interface SubmitPickResult {
  pick: ReturnType<typeof toPick>;
  snapshot: DraftStateSnapshot;
  isDraftComplete: boolean;
}

interface LockedDraftRow {
  id: string;
  currentPickIndex: number;
  order: string[];
  status: string;
  settings: unknown;
}

async function loadSnapshot(draftId: string): Promise<DraftStateSnapshot> {
  const draftRow = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draftRow) {
    throw new DraftError(`Draft ${draftId} not found`, 'DRAFT_NOT_FOUND');
  }
  const pickRows = await prisma.pick.findMany({
    where: { draftId },
    orderBy: { pickIndex: 'asc' },
  });
  return {
    draft: toDraft(draftRow),
    picks: pickRows.map(toPick),
    syncStatus: 'live',
    lastSyncedAt: null,
  };
}

export async function getSnapshot(draftId: string): Promise<DraftStateSnapshot> {
  return loadSnapshot(draftId);
}

/**
 * Locks the Draft row (SELECT ... FOR UPDATE), records a Pick at the
 * current pickIndex, and advances currentPickIndex/status - all inside the
 * caller's transaction. This is the single place a pick is ever written,
 * used by both manual submission and auto-pick/skip on clock expiry, so the
 * turn-advancement and completion logic can't drift between the two paths.
 */
async function recordPickAndAdvance(
  tx: Prisma.TransactionClient,
  draftId: string,
  teamId: string,
  playerId: string | null,
  source: 'manual' | 'auto' | 'skip',
  expectedPickIndex: number,
): Promise<{
  pick: ReturnType<typeof toPick>;
  snapshot: DraftStateSnapshot;
  isDraftComplete: boolean;
}> {
  const [draftRow] = await tx.$queryRaw<
    LockedDraftRow[]
  >`SELECT "id", "currentPickIndex", "order", "status", "settings" FROM "Draft" WHERE "id" = ${draftId} FOR UPDATE`;

  if (!draftRow) {
    throw new DraftError(`Draft ${draftId} not found`, 'DRAFT_NOT_FOUND');
  }
  if (draftRow.status !== 'in_progress') {
    throw new DraftError(`Draft ${draftId} is not in progress`, 'DRAFT_NOT_IN_PROGRESS');
  }

  if (playerId !== null) {
    // Checked first so a retried/duplicate request gets an unambiguous
    // PICK_ALREADY_TAKEN instead of a confusing NOT_YOUR_TURN.
    const existingForPlayer = await tx.pick.findFirst({ where: { draftId, playerId } });
    if (existingForPlayer) {
      throw new DraftError(`Player ${playerId} has already been drafted`, 'PICK_ALREADY_TAKEN');
    }
  }

  if (draftRow.currentPickIndex !== expectedPickIndex) {
    throw new DraftError('The draft advanced before this pick could be recorded', 'NOT_YOUR_TURN');
  }

  const onTheClockTeamId = draftRow.order[draftRow.currentPickIndex];
  if (onTheClockTeamId !== teamId) {
    throw new DraftError(`Team ${teamId} is not on the clock`, 'NOT_YOUR_TURN');
  }

  const pickRow = await tx.pick.create({
    data: { draftId, pickIndex: draftRow.currentPickIndex, teamId, playerId, source },
  });

  const nextPickIndex = draftRow.currentPickIndex + 1;
  const isDraftComplete = nextPickIndex >= draftRow.order.length;

  const updatedDraft = await tx.draft.update({
    where: { id: draftId },
    data: {
      currentPickIndex: nextPickIndex,
      status: isDraftComplete ? 'completed' : 'in_progress',
    },
  });

  if (!isDraftComplete) {
    const settings = draftRow.settings as { pickClockSeconds: number };
    await enqueueTurnNotification(tx, {
      draftId,
      pickIndex: nextPickIndex,
      teamId: draftRow.order[nextPickIndex],
      clockSeconds: settings.pickClockSeconds,
    });
  }

  const pickRows = await tx.pick.findMany({ where: { draftId }, orderBy: { pickIndex: 'asc' } });

  return {
    pick: toPick(pickRow),
    isDraftComplete,
    snapshot: {
      draft: toDraft(updatedDraft),
      picks: pickRows.map(toPick),
      syncStatus: 'live',
      lastSyncedAt: null,
    },
  };
}

async function afterPick(result: SubmitPickResult, draftId: string): Promise<void> {
  if (result.isDraftComplete) {
    await clearClock(draftId);
    return;
  }
  const settings = result.snapshot.draft.settings as { pickClockSeconds: number };
  await startClock(draftId, settings.pickClockSeconds);
}

/**
 * Submits a pick for the team currently on the clock.
 *
 * Concurrency (Req 3.8): the entire read-validate-write sequence happens
 * inside a single Postgres transaction that takes a row lock on the Draft
 * via `SELECT ... FOR UPDATE`. If two requests race for the same draft,
 * Postgres serializes them - the second one re-reads the now-updated
 * currentPickIndex/roster and fails its turn/duplicate-player check
 * deterministically, rather than both writes racing at the application level.
 */
export async function submitPick(input: SubmitPickInput): Promise<SubmitPickResult> {
  const result = await prisma.$transaction((tx) =>
    recordPickAndAdvance(
      tx,
      input.draftId,
      input.teamId,
      input.playerId,
      'manual',
      input.lastKnownPickIndex,
    ),
  );
  await afterPick(result, input.draftId);
  return result;
}

/**
 * Called when a pick's clock expires. Autopicks the best available
 * candidate from the deterministic ranking engine, or skips (records a
 * null-player Pick), per DraftSettings.autoPickOnExpiry (Req 3.5).
 */
export async function autoPickOrSkip(draftId: string): Promise<SubmitPickResult> {
  const snapshot = await loadSnapshot(draftId);
  const { draft } = snapshot;

  if (draft.status !== 'in_progress') {
    throw new DraftError(`Draft ${draftId} is not in progress`, 'DRAFT_NOT_IN_PROGRESS');
  }

  const onTheClockTeamId = draft.order[draft.currentPickIndex];
  let chosenPlayerId: string | null = null;
  if (draft.settings.autoPickOnExpiry) {
    const { candidates } = await getDeterministicCandidates(draftId, onTheClockTeamId);
    chosenPlayerId = candidates[0]?.playerId ?? null;
  }

  const source = chosenPlayerId ? 'auto' : 'skip';
  const result = await prisma.$transaction((tx) =>
    recordPickAndAdvance(
      tx,
      draftId,
      onTheClockTeamId,
      chosenPlayerId,
      source,
      draft.currentPickIndex,
    ),
  );
  await afterPick(result, draftId);
  return result;
}

/**
 * Reconnect/state-reconciliation (Req 3.3): returns the full current
 * snapshot plus only the picks made after the client's last known index,
 * so a reconnecting client can replay the delta instead of assuming it's
 * caught up.
 */
export async function getReconciliation(
  draftId: string,
  lastKnownPickIndex: number,
): Promise<{ snapshot: DraftStateSnapshot; delta: ReturnType<typeof toPick>[] }> {
  const snapshot = await loadSnapshot(draftId);
  const delta = snapshot.picks.filter((p) => p.pickIndex >= lastKnownPickIndex);
  return { snapshot, delta };
}
