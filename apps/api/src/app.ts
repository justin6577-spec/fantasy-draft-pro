import Fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { draftRoomRoutes } from './modules/draft-room/draft-room.routes';
import { leagueRoutes } from './modules/league-sync/league.routes';
import { recommendationRoutes } from './modules/recommendation/recommendation.routes';
import { newsRoutes } from './modules/news/news.routes';
import { revenuecatWebhookRoutes } from './modules/subscription/revenuecat-webhook.routes';
import { playerRoutes } from './modules/players/players.routes';
import { scoresRoutes } from './modules/scores/scores.routes';
import { gamedayRoutes } from './modules/gameday/gameday.routes';
import { pushTokenRoutes } from './modules/notification/push-token.routes';
import { registerNotificationWorker } from './modules/notification/notification.worker';
import { leagueLinkRoutes } from './modules/league-link/league-link.routes';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(fastifyJwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      iss: 'fantasy-draft-api',
      aud: 'fantasy-draft-mobile',
    },
    verify: {
      allowedIss: 'fantasy-draft-api',
      allowedAud: 'fantasy-draft-mobile',
    },
  });

  app.register(authRoutes);
  app.register(draftRoomRoutes);
  app.register(leagueRoutes);
  app.register(recommendationRoutes);
  app.register(newsRoutes);
  app.register(revenuecatWebhookRoutes);
  app.register(playerRoutes);
  app.register(scoresRoutes);
  app.register(gamedayRoutes);
  app.register(pushTokenRoutes);
  app.register(leagueLinkRoutes);
  registerNotificationWorker(app);

  return app;
}
