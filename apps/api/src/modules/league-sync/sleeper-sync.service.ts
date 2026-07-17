/**
 * Sleeper sync service — polls Sleeper drafts, diffs state, and emits
 * normalized DraftEvents through the Socket.IO gateway.
 *
 * Manages the full lifecycle:
 *  1. Import a Sleeper league (creates LeagueLink + League + Draft)
 *  2. Poll for changes (runs on an interval)
 *  3. Diff and emit new picks
 *  4. Update sync status metadata
 */

import { randomUUID } from 'node:crypto';
import type { Server as SocketIOServer } from 'socket.io';
import type { PickMadeEvent, TurnChangedEvent } from '@fantasy-draft/shared';
import { prisma } from '../../lib/prisma';
import {
  fetchLeague,
  fetchSleeperDraftState,
  fetchDrafts,
  diffSleeperPicks,
} from './providers/sleeper.provider';

const CACHE_TTL_MS = 60_000; // re-poll every 60s

/** In-memory cache of last-known Sleeper draft state per sleeper_draft_id. */
const lastKnownState = new Map<string, {
  state: import('./providers/sleeper.provider').SleeperDraftState;
  fetchedAt: number;
}>();

function normalizeSleeperScoring(settings: Record<string, number> | undefined): object {
  const receptionPoints = settings?.rec ?? 0;
  const type = receptionPoints === 1
    ? 'ppr'
    : receptionPoints === 0.5
      ? 'half_ppr'
      : receptionPoints === 0
        ? 'standard'
        : 'custom';
  return { type, receptionPoints, ...(settings ?? {}) };
}

function normalizeSleeperRoster(positions: string[]): object {
  const roster = { qb: 0, rb: 0, wr: 0, te: 0, flex: 0, k: 0, dst: 0, bench: 0 };
  for (const rawPosition of positions) {
    const position = rawPosition.toUpperCase();
    if (position === 'QB') roster.qb += 1;
    else if (position === 'RB') roster.rb += 1;
    else if (position === 'WR') roster.wr += 1;
    else if (position === 'TE') roster.te += 1;
    else if (position === 'K') roster.k += 1;
    else if (position === 'DEF') roster.dst += 1;
    else if (position === 'FLEX' || position === 'W/R/T' || position === 'SUPER_FLEX') roster.flex += 1;
    else if (position === 'BN') roster.bench += 1;
  }
  return roster;
}

/**
 * Imports a Sleeper league into the app. Creates:
 *  - LeagueLink (connects user ↔ external league)
 *  - League record
 *  - Draft record
 *  - DraftParticipant entries (one per roster)
 *
 * Returns the internal draftId so the caller can join the WebSocket room.
 */
export async function importSleeperLeague(
  userId: string,
  sleeperLeagueId: string,
  io: SocketIOServer | null,
): Promise<{ draftId: string }> {
  const [league, drafts] = await Promise.all([
    fetchLeague(sleeperLeagueId),
    fetchDrafts(sleeperLeagueId),
  ]);

  const activeDraft = drafts.find((d) => d.status === 'drafting' || d.status === 'pre_draft');
  if (!activeDraft) {
    throw new Error(`No active draft found in Sleeper league ${sleeperLeagueId}`);
  }

  // Build order from slot_to_roster_id (deterministic roster ordering)
  const slots = Object.values(activeDraft.slot_to_roster_id ?? {});
  const order = Array.from(new Set(slots.map(String)));

  // Each external roster is represented by its stable team ID.
  const participants = order.map((teamId, i) => ({
    userId, // all participants map to the importing user (read-only sync)
    teamId,
    pickOrder: i,
  }));

  const draftId = randomUUID();
  const leagueRecordId = randomUUID();

  await prisma.$transaction(async (tx) => {
    // Create League
    await tx.league.create({
      data: {
        id: leagueRecordId,
        name: league.name,
        platform: 'sleeper',
        seasonId: league.season,
        scoringSettings: normalizeSleeperScoring(league.scoring_settings),
        rosterSettings: normalizeSleeperRoster(league.roster_positions),
      },
    });

    // Create Draft
    await tx.draft.create({
      data: {
        id: draftId,
        leagueId: leagueRecordId,
        order,
        currentPickIndex: 0,
        clockSecondsRemaining: activeDraft.settings.pick_timer ?? 120,
        status: activeDraft.status === 'complete' ? 'completed' : 'in_progress',
        settings: {
          pickClockSeconds: activeDraft.settings.pick_timer ?? 120,
          autoPickOnExpiry: false,
          rounds: activeDraft.settings.rounds ?? 15,
        },
        participants: {
          create: participants.map((p) => ({
            userId: p.userId,
            teamId: p.teamId,
          })),
        },
      },
    });

    // Create LeagueLink
    await tx.leagueLink.create({
      data: {
        userId,
        platform: 'sleeper',
        externalLeagueId: sleeperLeagueId,
        status: 'active',
        leagueId: leagueRecordId,
      },
    });
  });

  // Fetch initial picks and cache state
  const state = await fetchSleeperDraftState(activeDraft.draft_id);
  lastKnownState.set(activeDraft.draft_id, { state, fetchedAt: Date.now() });

  // If draft already has picks, replay them so the room has state
  if (state.picks.length > 0 && io) {
    for (const pick of state.picks) {
      const pickMade: PickMadeEvent = {
        type: 'pick.made',
        draftId,
        pick: {
          id: `${draftId}-${pick.pickIndex}`,
          draftId,
          pickIndex: pick.pickIndex,
          teamId: pick.teamId,
          playerId: pick.playerId,
          madeAt: new Date().toISOString(),
          source: 'manual',
        },
      };
      io.to(`draft:${draftId}`).emit('pick.made', pickMade);
    }
  }

  return { draftId };
}

/**
 * Polls a single Sleeper draft, diffs against last known state, and emits
 * any new picks through the Socket.IO server. Call this on an interval.
 */
export async function pollSleeperDraft(
  sleeperDraftId: string,
  internalDraftId: string,
  io: SocketIOServer,
): Promise<void> {
  const cached = lastKnownState.get(sleeperDraftId);
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;

  if (age < CACHE_TTL_MS) return; // not stale yet

  try {
    const newState = await fetchSleeperDraftState(sleeperDraftId);
    const oldState = cached?.state;

    if (oldState) {
      const newPicks = diffSleeperPicks(oldState, newState);
      for (const pick of newPicks) {
        const pickMade: PickMadeEvent = {
          type: 'pick.made',
          draftId: internalDraftId,
          pick: {
            id: `${internalDraftId}-${pick.pickIndex}`,
            draftId: internalDraftId,
            pickIndex: pick.pickIndex,
            teamId: pick.teamId,
            playerId: pick.playerId,
            madeAt: new Date().toISOString(),
            source: 'manual',
          },
        };
        io.to(`draft:${internalDraftId}`).emit('pick.made', pickMade);

        // Emit turn.changed for the next pick
        if (pick.pickIndex + 1 < newState.picks.length) {
          const nextPickIndex = pick.pickIndex + 1;
          const turnChanged: TurnChangedEvent = {
            type: 'turn.changed',
            draftId: internalDraftId,
            currentPickIndex: nextPickIndex,
            onTheClockTeamId: newState.picks[nextPickIndex]?.teamId ?? '',
            clockSecondsRemaining: 0,
          };
          io.to(`draft:${internalDraftId}`).emit('turn.changed', turnChanged);
        }
      }
    }

    // Persist picks to our DB so they survive restarts
    if (oldState && newState.picks.length > oldState.picks.length) {
      const newOnes = oldState ? diffSleeperPicks(oldState, newState) : newState.picks;
      for (const pick of newOnes) {
        await prisma.pick.upsert({
          where: {
            draftId_pickIndex: { draftId: internalDraftId, pickIndex: pick.pickIndex },
          },
          update: { playerId: pick.playerId, teamId: pick.teamId },
          create: {
            draftId: internalDraftId,
            pickIndex: pick.pickIndex,
            teamId: pick.teamId,
            playerId: pick.playerId,
            source: 'manual',
          },
        });
      }
    }

    // Update lastKnownState
    lastKnownState.set(sleeperDraftId, { state: newState, fetchedAt: Date.now() });

    // Update lastSyncedAt on the LeagueLink
    const link = await prisma.leagueLink.findFirst({
      where: { externalLeagueId: sleeperDraftId, platform: 'sleeper' },
    });
    if (link) {
      await prisma.leagueLink.update({
        where: { id: link.id },
        data: { lastSyncedAt: new Date() },
      });
    }
  } catch (error) {
    console.error(`[SleeperSync] Poll failed for ${sleeperDraftId}:`, (error as Error).message);
  }
}
