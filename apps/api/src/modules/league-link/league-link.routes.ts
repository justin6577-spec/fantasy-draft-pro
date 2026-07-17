import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.guard';
import { CredentialEncryptionConfigurationError } from './league-link.crypto';
import { leagueLinkService, LeagueLinkNotFoundError } from './league-link.service';

const externalLeagueId = z.string().trim().min(1).max(200);
const linkRequestSchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('sleeper'),
    externalLeagueId,
  }).strict(),
  z.object({
    platform: z.literal('yahoo'),
    externalLeagueId,
    credentials: z.object({
      accessToken: z.string().min(1).max(4096),
      tokenSecret: z.string().min(1).max(4096),
      sessionHandle: z.string().min(1).max(4096).nullable().optional().default(null),
      expiresAt: z.number().int().positive().nullable().optional().default(null),
    }).strict(),
  }).strict(),
]);
const linkParamsSchema = z.object({ linkId: z.string().uuid() });

export async function leagueLinkRoutes(app: FastifyInstance): Promise<void> {
  app.get('/league-links', { preHandler: requireAuth }, async (request) => ({
    links: await leagueLinkService.list(request.user.sub),
  }));

  app.post('/league-links', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = linkRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'Provide a valid platform link request',
        issues: parsed.error.flatten(),
      });
    }

    try {
      const link = await leagueLinkService.link(request.user.sub, parsed.data);
      return reply.code(200).send({ link });
    } catch (error) {
      if (error instanceof CredentialEncryptionConfigurationError) {
        return reply.code(503).send({
          error: 'service_unavailable',
          message: 'Yahoo credential storage is not configured on the server',
        });
      }
      throw error;
    }
  });

  app.delete('/league-links/:linkId', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = linkParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }

    try {
      await leagueLinkService.disconnect(request.user.sub, parsed.data.linkId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof LeagueLinkNotFoundError) {
        return reply.code(404).send({ error: 'not_found', message: 'League link not found' });
      }
      throw error;
    }
  });
}
