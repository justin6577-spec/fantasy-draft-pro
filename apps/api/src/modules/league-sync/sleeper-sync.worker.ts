/**
 * Sleeper sync worker — polls all active Sleeper-linked leagues on an
 * interval and pushes new picks through the WebSocket room model.
 */

import type { FastifyInstance } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../../lib/prisma';
import { pollSleeperDraft } from './sleeper-sync.service';

const POLL_INTERVAL_MS = 60_000; // every 60s

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let ioRef: SocketIOServer | null = null;

/**
 * Registers the Sleeper polling worker with the Fastify lifecycle.
 * Starts on app ready, stops on close.
 */
export function registerSleeperWorker(app: FastifyInstance, io: SocketIOServer): void {
  ioRef = io;

  // Initial poll after short delay to let the app settle
  const initialTimeout = setTimeout(() => {
    void pollAllSleeperDrafts();
  }, 5_000);

  // Recurring poll
  intervalHandle = setInterval(() => {
    void pollAllSleeperDrafts();
  }, POLL_INTERVAL_MS);

  app.addHook('onClose', () => {
    clearTimeout(initialTimeout);
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  });
}

/** Iterates all active Sleeper league links and polls their drafts. */
async function pollAllSleeperDrafts(): Promise<void> {
  if (!ioRef) return;

  try {
    const links = await prisma.leagueLink.findMany({
      where: { platform: 'sleeper', status: 'active' },
      include: { league: { include: { drafts: true } } },
    });

    for (const link of links) {
      const sleeperDraftId = link.externalLeagueId;
      if (!sleeperDraftId) continue;

      // Find the internal draft for this league
      const draft = link.league?.drafts?.[0];
      if (!draft) continue;

      await pollSleeperDraft(sleeperDraftId, draft.id, ioRef);
    }
  } catch (error) {
    console.error('[SleeperWorker] pollAll failed:', (error as Error).message);
  }
}
