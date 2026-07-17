export type EntitlementTier = 'free' | 'premium';

export type EntitlementStatus = 'active' | 'expired' | 'grace_period' | 'revoked';

export interface Entitlement {
  userId: string;
  tier: EntitlementTier;
  seasonId: string | null;
  expiresAt: string | null;
  source: 'revenuecat';
  status: EntitlementStatus;
}
