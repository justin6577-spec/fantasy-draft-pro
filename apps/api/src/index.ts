import { env } from './config/env';
import { buildApp } from './app';
import { registerDraftRoomGateway } from './modules/draft-room/draft-room.gateway';

async function main(): Promise<void> {
  const app = buildApp();

  // Attach Socket.IO and register cleanup hooks before Fastify starts.
  registerDraftRoomGateway(app);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  app.log.info(`Fantasy Draft Assistant API listening on port ${env.PORT}`);
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
