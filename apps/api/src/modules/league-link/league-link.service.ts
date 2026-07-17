import type { LeagueLink, LeaguePlatform } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { YahooOAuthTokens } from '../league-sync/providers/yahoo.provider';
import { encryptYahooCredentials } from './league-link.crypto';

export type ManagedLeaguePlatform = Extract<LeaguePlatform, 'sleeper' | 'yahoo'>;

export type ManagedLinkRequest =
  | { platform: 'sleeper'; externalLeagueId: string }
  | { platform: 'yahoo'; externalLeagueId: string; credentials: YahooOAuthTokens };

export interface LeagueLinkView {
  id: string;
  platform: ManagedLeaguePlatform;
  externalLeagueId: string;
  status: LeagueLink['status'];
  lastSyncedAt: string | null;
  leagueId: string | null;
  hasCredentials: boolean;
}

export interface LeagueLinkStore {
  listByUser(userId: string): Promise<LeagueLink[]>;
  upsertManaged(input: {
    userId: string;
    platform: ManagedLeaguePlatform;
    externalLeagueId: string;
    credentialsEnc: string | null;
  }): Promise<LeagueLink>;
  findByIdForUser(userId: string, linkId: string): Promise<LeagueLink | null>;
  disconnect(userId: string, linkId: string): Promise<LeagueLink>;
}

const prismaLeagueLinkStore: LeagueLinkStore = {
  listByUser: (userId) =>
    prisma.leagueLink.findMany({
      where: { userId, platform: { in: ['sleeper', 'yahoo'] } },
      orderBy: [{ platform: 'asc' }, { externalLeagueId: 'asc' }],
    }),
  upsertManaged: async ({ userId, platform, externalLeagueId, credentialsEnc }) => {
    const existing = await prisma.leagueLink.findFirst({
      where: { userId, platform, externalLeagueId },
    });
    if (existing) {
      return prisma.leagueLink.update({
        where: { id: existing.id },
        data: { credentialsEnc, status: 'active', lastSyncedAt: null },
      });
    }
    return prisma.leagueLink.create({
      data: { userId, platform, externalLeagueId, credentialsEnc, status: 'active' },
    });
  },
  findByIdForUser: (userId, linkId) =>
    prisma.leagueLink.findFirst({ where: { id: linkId, userId } }),
  disconnect: (userId, linkId) =>
    prisma.leagueLink.update({
      where: { id: linkId, userId },
      data: {
        status: 'disconnected',
        credentialsEnc: null,
        lastSyncedAt: null,
      },
    }),
};

export class LeagueLinkNotFoundError extends Error {
  constructor() {
    super('League link not found');
    this.name = 'LeagueLinkNotFoundError';
  }
}

function toView(link: LeagueLink): LeagueLinkView {
  if (
    (link.platform !== 'sleeper' && link.platform !== 'yahoo') ||
    !link.externalLeagueId
  ) {
    throw new Error('Unsupported managed league link');
  }
  return {
    id: link.id,
    platform: link.platform,
    externalLeagueId: link.externalLeagueId,
    status: link.status,
    lastSyncedAt: link.lastSyncedAt?.toISOString() ?? null,
    leagueId: link.leagueId,
    hasCredentials: Boolean(link.credentialsEnc),
  };
}

export class LeagueLinkService {
  constructor(private readonly store: LeagueLinkStore = prismaLeagueLinkStore) {}

  async list(userId: string): Promise<LeagueLinkView[]> {
    return (await this.store.listByUser(userId)).map(toView);
  }

  async link(userId: string, request: ManagedLinkRequest): Promise<LeagueLinkView> {
    const credentialsEnc =
      request.platform === 'yahoo' ? encryptYahooCredentials(request.credentials) : null;
    const link = await this.store.upsertManaged({
      userId,
      platform: request.platform,
      externalLeagueId: request.externalLeagueId,
      credentialsEnc,
    });
    return toView(link);
  }

  async disconnect(userId: string, linkId: string): Promise<void> {
    const ownedLink = await this.store.findByIdForUser(userId, linkId);
    if (!ownedLink) throw new LeagueLinkNotFoundError();
    if (ownedLink.status === 'disconnected' && !ownedLink.credentialsEnc) return;

    // Retain shared League/Draft records; only disable this user's link and erase its credentials.
    await this.store.disconnect(userId, linkId);
  }
}

export const leagueLinkService = new LeagueLinkService();
