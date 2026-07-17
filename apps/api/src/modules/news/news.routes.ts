/**
 * News routes — player news summaries + watchlist management.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../auth/auth.guard';
import { getOrCreateSummary } from './news-summarizer.service';

export async function newsRoutes(app: FastifyInstance): Promise<void> {
  // ── Player news summary ──────────────────────────────────────────
  app.get('/players/:playerId/news', async (request, reply) => {
    const { playerId } = request.params as { playerId: string };
    const result = await getOrCreateSummary(playerId);

    if (result.status === 'no_recent_news') {
      return reply.send({ status: 'no_recent_news', playerId });
    }

    return reply.send({
      status: 'ok',
      summary: {
        id: `sum_${playerId}`,
        articleClusterId: `cluster_${playerId}`,
        playerId,
        summaryText: result.summaryText,
        impactTag: result.impactTag,
        citedSources: [],
        generatedAt: result.generatedAt,
      },
    });
  });

  // ── Watchlist ────────────────────────────────────────────────────

  app.get('/watchlist', { preHandler: requireAuth }, async (request) => {
    const entries = await prisma.watchlistEntry.findMany({
      where: { userId: request.user.sub },
      include: { player: { select: { id: true, name: true, position: true, team: true } } },
    });
    return {
      watchlist: entries.map((e) => ({
        playerId: e.playerId,
        name: e.player.name,
        position: e.player.position,
        team: e.player.team,
      })),
    };
  });

  const watchlistSchema = z.object({ playerId: z.string().min(1) });

  app.post('/watchlist', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = watchlistSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }
    try {
      await prisma.watchlistEntry.create({
        data: { userId: request.user.sub, playerId: parsed.data.playerId },
      });
      return reply.code(201).send({ status: 'added' });
    } catch {
      return reply.code(409).send({ error: 'already_on_watchlist', message: 'Player already on watchlist' });
    }
  });

  app.delete('/watchlist/:playerId', { preHandler: requireAuth }, async (request, reply) => {
    const { playerId } = request.params as { playerId: string };
    await prisma.watchlistEntry.delete({
      where: { userId_playerId: { userId: request.user.sub, playerId } },
    });
    return reply.code(204).send();
  });
}
