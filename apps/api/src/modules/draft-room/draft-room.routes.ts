import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.guard';
import { getSnapshot } from './draft-room.service';
import { createAndStartDraft } from './draft-room.admin';
import { DraftError } from './draft-room.errors';
import { DraftAccessError, requireDraftParticipant } from './draft-access';

const createDraftSchema = z.object({
  leagueId: z.string().min(1),
  order: z.array(z.string().min(1)).min(2),
  participants: z
    .array(z.object({ userId: z.string().min(1), teamId: z.string().min(1) }))
    .min(2),
  settings: z.object({
    pickClockSeconds: z.number().int().positive(),
    autoPickOnExpiry: z.boolean(),
    rounds: z.number().int().positive(),
  }),
});

/** Protected REST lifecycle routes around the live WebSocket draft flow. */
export async function draftRoomRoutes(app: FastifyInstance): Promise<void> {
  app.get('/drafts/:draftId', { preHandler: requireAuth }, async (request, reply) => {
    const { draftId } = request.params as { draftId: string };
    try {
      await requireDraftParticipant(draftId, request.user.sub);
      return reply.send(await getSnapshot(draftId));
    } catch (error) {
      if (error instanceof DraftAccessError) {
        return reply.code(403).send({ error: 'draft_access_denied', message: error.message });
      }
      if (error instanceof DraftError && error.code === 'DRAFT_NOT_FOUND') {
        return reply.code(404).send({ error: 'draft_not_found', message: error.message });
      }
      throw error;
    }
  });

  app.post('/drafts', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }

    try {
      const draft = await createAndStartDraft({
        ...parsed.data,
        creatorUserId: request.user.sub,
      });
      return reply.code(201).send(draft);
    } catch (error) {
      if (error instanceof DraftAccessError) {
        return reply.code(400).send({ error: 'invalid_participants', message: error.message });
      }
      throw error;
    }
  });
}
