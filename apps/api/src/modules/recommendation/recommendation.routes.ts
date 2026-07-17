import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/auth.guard';
import { DraftAccessError, requireDraftParticipant } from '../draft-room/draft-access';
import { getRecommendations, RecommendationError } from './recommendation.service';

export async function recommendationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/drafts/:draftId/recommendations',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { draftId } = request.params as { draftId: string };
      try {
        const teamId = await requireDraftParticipant(draftId, request.user.sub);
        return reply.send(await getRecommendations(draftId, teamId));
      } catch (error) {
        if (error instanceof DraftAccessError) {
          return reply.code(403).send({ error: 'draft_access_denied', message: error.message });
        }
        if (error instanceof RecommendationError && error.code === 'DRAFT_NOT_FOUND') {
          return reply.code(404).send({ error: 'draft_not_found', message: error.message });
        }
        throw error;
      }
    },
  );
}
