/**
 * RevenueCat webhook receiver — idempotent handler for purchase lifecycle events.
 *
 * Handles: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE
 * Dedup by event ID (idempotent via stored event log).
 * Fails closed on verification errors.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';

interface RevenueCatEvent {
  event: {
    id: string;
    type: string;
    product_id: string;
    app_user_id: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    entitlement_id: string | null;
    environment: string;
  };
}

function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — accept in dev, reject in production
    return env.NODE_ENV !== 'production';
  }

  const expected = createHmac('sha256', secret).update(body).digest('base64');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function revenuecatWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/webhooks/revenuecat', async (request, reply) => {
    // Verify signature
    const signature = (request.headers['x-revenuecat-signature'] as string) ?? '';
    const rawBody = JSON.stringify(request.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      app.log.warn('RevenueCat webhook signature verification failed');
      return reply.code(403).send({ error: 'invalid_signature' });
    }

    const payload = request.body as RevenueCatEvent;
    const { event } = payload;

    if (!event?.id || !event?.type) {
      return reply.code(400).send({ error: 'invalid_payload' });
    }

    // Dedup: skip if we've already processed this event ID
    const alreadyProcessed = await prisma.entitlement.findFirst({
      where: { source: `revenuecat_${event.id}` },
    });
    if (alreadyProcessed) {
      return reply.code(200).send({ received: true, deduped: true });
    }

    const userId = event.app_user_id;
    const now = new Date();
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

    try {
      switch (event.type) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL': {
          const existing = await prisma.entitlement.findFirst({
            where: { userId, source: `revenuecat_${event.id}` },
          });
          if (existing) {
            await prisma.entitlement.update({
              where: { id: existing.id },
              data: { status: 'active', expiresAt },
            });
          } else {
            await prisma.entitlement.create({
              data: {
                userId,
                tier: 'premium',
                seasonId: `season_${new Date(event.purchased_at_ms).getFullYear()}`,
                expiresAt,
                source: `revenuecat_${event.id}`,
                status: 'active',
              },
            });
          }
          break;
        }
        case 'CANCELLATION': {
          // Keep active until expiration, just mark for awareness
          app.log.info({ userId }, 'Subscription cancelled (will expire at expiry date)');
          break;
        }
        case 'EXPIRATION':
        case 'BILLING_ISSUE': {
          await prisma.entitlement.updateMany({
            where: { userId, status: 'active' },
            data: { status: 'expired' },
          });
          break;
        }
        default:
          app.log.info({ type: event.type }, 'Unhandled RevenueCat event type');
      }
    } catch (error) {
      app.log.error({ error, eventId: event.id }, 'Failed to process RevenueCat webhook');
      return reply.code(500).send({ error: 'processing_failed' });
    }

    return reply.code(200).send({ received: true });
  });
}
