import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../auth/auth.guard';

const expoPushTokenPattern = /^Expo(?:nent)?PushToken\[[^\]]+\]$/;
const registerTokenSchema = z.object({
  token: z.string().regex(expoPushTokenPattern, 'Invalid Expo push token'),
  installationId: z.string().min(16).max(128),
  platform: z.enum(['ios', 'android']),
});

const installationParamsSchema = z.object({
  installationId: z.string().min(16).max(128),
});

/** Authenticated per-installation token registration and logout deactivation. */
export async function pushTokenRoutes(app: FastifyInstance): Promise<void> {
  app.put('/notifications/push-token', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = registerTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }

    const { token, installationId, platform } = parsed.data;
    await prisma.$transaction(async (tx) => {
      // Expo tokens and installations both represent one current app install.
      // Moving either to another signed-in account invalidates the old binding.
      await tx.pushToken.deleteMany({
        where: { token, installationId: { not: installationId } },
      });
      await tx.pushToken.upsert({
        where: { installationId },
        create: {
          userId: request.user.sub,
          token,
          installationId,
          platform,
        },
        update: {
          userId: request.user.sub,
          token,
          platform,
          enabled: true,
          lastSeenAt: new Date(),
        },
      });
    });

    return reply.code(204).send();
  });

  app.delete(
    '/notifications/push-token/:installationId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = installationParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
      }

      await prisma.pushToken.updateMany({
        where: {
          userId: request.user.sub,
          installationId: parsed.data.installationId,
        },
        data: { enabled: false, lastSeenAt: new Date() },
      });
      return reply.code(204).send();
    },
  );
}
