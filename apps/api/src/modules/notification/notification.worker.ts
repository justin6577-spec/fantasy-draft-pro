import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env';
import { processTurnNotificationOutbox } from './turn-notification.service';

const POLL_INTERVAL_MS = 2_000;

/** Registers a lightweight DB-outbox worker with the Fastify lifecycle. */
export function registerNotificationWorker(app: FastifyInstance): void {
  if (env.NODE_ENV === 'test') return;

  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      await processTurnNotificationOutbox();
    } catch (error) {
      app.log.error({ error }, 'Push notification outbox poll failed');
    } finally {
      running = false;
    }
  };

  app.addHook('onReady', async () => {
    await poll();
    timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    timer.unref?.();
  });

  app.addHook('onClose', async () => {
    if (timer) clearInterval(timer);
    timer = null;
  });
}
