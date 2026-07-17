import type { Draft as PrismaDraft, Pick as PrismaPick } from '@prisma/client';
import type { Draft, DraftSettings, Pick } from '@fantasy-draft/shared';

/**
 * Maps Prisma rows (Json columns, Date objects, nullable playerId for
 * skip-picks) to the wire-format shared types used in DraftEvent payloads
 * and REST responses.
 */
export function toDraft(row: PrismaDraft): Draft {
  return {
    id: row.id,
    leagueId: row.leagueId,
    order: row.order,
    currentPickIndex: row.currentPickIndex,
    clockSecondsRemaining: row.clockSecondsRemaining,
    status: row.status,
    settings: row.settings as unknown as DraftSettings,
  };
}

export function toPick(row: PrismaPick): Pick {
  return {
    id: row.id,
    draftId: row.draftId,
    pickIndex: row.pickIndex,
    teamId: row.teamId,
    playerId: row.playerId ?? '',
    madeAt: row.madeAt.toISOString(),
    source: row.source,
  };
}
