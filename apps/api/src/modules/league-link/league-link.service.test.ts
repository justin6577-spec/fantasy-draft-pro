import { randomBytes, randomUUID } from 'node:crypto';
import type { LeagueLink } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  CredentialEncryptionConfigurationError,
  decryptYahooCredentials,
  encryptYahooCredentials,
} from './league-link.crypto';
import {
  LeagueLinkNotFoundError,
  LeagueLinkService,
  type LeagueLinkStore,
} from './league-link.service';

class FakeLeagueLinkStore implements LeagueLinkStore {
  readonly links: LeagueLink[] = [];

  async listByUser(userId: string): Promise<LeagueLink[]> {
    return this.links.filter((link) => link.userId === userId);
  }

  async upsertManaged(input: {
    userId: string;
    platform: 'sleeper' | 'yahoo';
    externalLeagueId: string;
    credentialsEnc: string | null;
  }): Promise<LeagueLink> {
    const existing = this.links.find(
      (link) =>
        link.userId === input.userId &&
        link.platform === input.platform &&
        link.externalLeagueId === input.externalLeagueId,
    );
    if (existing) {
      existing.status = 'active';
      existing.credentialsEnc = input.credentialsEnc;
      existing.lastSyncedAt = null;
      return existing;
    }
    const created: LeagueLink = {
      id: randomUUID(),
      userId: input.userId,
      platform: input.platform,
      externalLeagueId: input.externalLeagueId,
      credentialsEnc: input.credentialsEnc,
      lastSyncedAt: null,
      status: 'active',
      leagueId: null,
    };
    this.links.push(created);
    return created;
  }

  async findByIdForUser(userId: string, linkId: string): Promise<LeagueLink | null> {
    return this.links.find((link) => link.id === linkId && link.userId === userId) ?? null;
  }

  async disconnect(userId: string, linkId: string): Promise<LeagueLink> {
    const link = await this.findByIdForUser(userId, linkId);
    if (!link) throw new Error('missing link');
    link.status = 'disconnected';
    link.credentialsEnc = null;
    link.lastSyncedAt = null;
    return link;
  }
}

const key = randomBytes(32).toString('base64');
const yahooCredentials = {
  accessToken: 'access-secret',
  tokenSecret: 'token-secret',
  sessionHandle: 'session-secret',
  expiresAt: 2_000_000_000_000,
};

describe('Yahoo credential encryption', () => {
  it('round-trips with AES-GCM without exposing plaintext', () => {
    const encrypted = encryptYahooCredentials(yahooCredentials, key);
    expect(encrypted).not.toContain(yahooCredentials.accessToken);
    expect(decryptYahooCredentials(encrypted, key)).toEqual(yahooCredentials);
  });

  it('rejects credential storage without a valid configured key', () => {
    expect(() => encryptYahooCredentials(yahooCredentials, '')).toThrow(
      CredentialEncryptionConfigurationError,
    );
  });

  it('rejects tampered encrypted credentials', () => {
    const encrypted = encryptYahooCredentials(yahooCredentials, key);
    // Corrupt the format version to guarantee a throw
    const tampered = `v0.invalid.${encrypted.split('.').slice(2).join('.')}`;
    expect(() => decryptYahooCredentials(tampered, key)).toThrow();
  });
});

describe('LeagueLinkService', () => {
  it('links the same external league idempotently', async () => {
    const store = new FakeLeagueLinkStore();
    const service = new LeagueLinkService(store);

    const first = await service.link('user-a', {
      platform: 'sleeper',
      externalLeagueId: 'league-123',
    });
    const second = await service.link('user-a', {
      platform: 'sleeper',
      externalLeagueId: 'league-123',
    });

    expect(second.id).toBe(first.id);
    expect(store.links).toHaveLength(1);
  });

  it('enforces ownership and clears only link-specific credentials on disconnect', async () => {
    const store = new FakeLeagueLinkStore();
    const service = new LeagueLinkService(store);
    const linked = await store.upsertManaged({
      userId: 'owner',
      platform: 'yahoo',
      externalLeagueId: 'nfl.l.123',
      credentialsEnc: 'encrypted-value',
    });
    linked.leagueId = 'shared-league-id';

    await expect(service.disconnect('another-user', linked.id)).rejects.toBeInstanceOf(
      LeagueLinkNotFoundError,
    );
    expect(linked.status).toBe('active');

    await service.disconnect('owner', linked.id);
    expect(linked).toMatchObject({
      status: 'disconnected',
      credentialsEnc: null,
      leagueId: 'shared-league-id',
    });
    await expect(service.disconnect('owner', linked.id)).resolves.toBeUndefined();
  });
});
