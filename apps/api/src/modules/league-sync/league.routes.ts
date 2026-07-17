/**
 * League link management routes — list, link, and disconnect
 * external platform leagues (Sleeper, Yahoo).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../auth/auth.guard';
import { importSleeperLeague } from './sleeper-sync.service';

export async function leagueRoutes(app: FastifyInstance): Promise<void> {
  // ── List linked leagues ──────────────────────────────────────────
  app.get('/leagues', { preHandler: requireAuth }, async (request) => {
    const links = await prisma.leagueLink.findMany({
      where: { userId: request.user.sub },
      include: { league: { select: { id: true, name: true } } },
      orderBy: { lastSyncedAt: { sort: 'desc', nulls: 'last' } },
    });

    return {
      leagues: links.map((link) => ({
        id: link.id,
        platform: link.platform,
        name: link.league?.name ?? link.externalLeagueId ?? 'Unknown',
        status: link.status,
        lastSyncedAt: link.lastSyncedAt?.toISOString() ?? null,
      })),
    };
  });

  // ── Link a Sleeper league ────────────────────────────────────────
  const linkSleeperSchema = z.object({
    sleeperLeagueId: z.string().min(1),
  });

  app.post('/leagues/link/sleeper', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = linkSleeperSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }

    // Check if already linked
    const existing = await prisma.leagueLink.findFirst({
      where: {
        userId: request.user.sub,
        platform: 'sleeper',
        externalLeagueId: parsed.data.sleeperLeagueId,
      },
    });
    if (existing) {
      return reply.code(409).send({ error: 'already_linked', message: 'League is already linked' });
    }

    try {
      const result = await importSleeperLeague(
        request.user.sub,
        parsed.data.sleeperLeagueId,
        null, // Socket.IO server — passed in during app setup
      );
      return reply.code(201).send({ draftId: result.draftId });
    } catch (error) {
      return reply.code(400).send({
        error: 'import_failed',
        message: (error as Error).message,
      });
    }
  });

  // ── Disconnect a linked league ───────────────────────────────────
  app.delete('/leagues/:linkId', { preHandler: requireAuth }, async (request, reply) => {
    const { linkId } = request.params as { linkId: string };

    const link = await prisma.leagueLink.findUnique({ where: { id: linkId } });
    if (!link) {
      return reply.code(404).send({ error: 'not_found', message: 'League link not found' });
    }
    if (link.userId !== request.user.sub) {
      return reply.code(403).send({ error: 'forbidden', message: 'Not your league link' });
    }

    await prisma.leagueLink.update({
      where: { id: linkId },
      data: { status: 'disconnected' },
    });

    return reply.code(204).send();
  });
}
