import type { Entitlement } from '@fantasy-draft/shared';
import { prisma } from '../../lib/prisma';

/**
 * Subscription Service (design.md "5.").
 * Backend entitlement record is the authoritative source checked on every
 * premium-gated request - NOT the client's local receipt (Req 4.2, 4.5).
 * Fails closed: if state is ever ambiguous, treat the user as not entitled.
 *
 * TODO (tasks.md #10): RevenueCat webhook handler (idempotent), expiration
 * reminder job, premium-gating middleware.
 */
export async function isEntitled(userId: string): Promise<boolean> {
  const entitlement = await prisma.entitlement.findFirst({
    where: { userId, status: 'active', tier: 'premium' },
    orderBy: { expiresAt: 'desc' },
  });

  if (!entitlement) return false;
  if (entitlement.expiresAt && entitlement.expiresAt.getTime() < Date.now()) return false;
  return true;
}

export async function getEntitlement(userId: string): Promise<Entitlement | null> {
  const record = await prisma.entitlement.findFirst({
    where: { userId },
    orderBy: { expiresAt: 'desc' },
  });
  if (!record) return null;
  return {
    userId: record.userId,
    tier: record.tier,
    seasonId: record.seasonId,
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
    source: 'revenuecat',
    status: record.status,
  };
}
