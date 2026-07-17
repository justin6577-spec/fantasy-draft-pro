import { authFetch } from './client';

export type LeagueLinkPlatform = 'sleeper' | 'yahoo';
export type LeagueLinkStatus = 'active' | 'expired' | 'disconnected';

export interface LeagueLink {
  id: string;
  platform: LeagueLinkPlatform;
  externalLeagueId: string;
  status: LeagueLinkStatus;
  lastSyncedAt: string | null;
  leagueId: string | null;
  hasCredentials: boolean;
}

export function listLeagueLinks(): Promise<{ links: LeagueLink[] }> {
  return authFetch('/league-links');
}

export function linkSleeperLeague(externalLeagueId: string): Promise<{ link: LeagueLink }> {
  return authFetch('/league-links', {
    method: 'POST',
    body: JSON.stringify({ platform: 'sleeper', externalLeagueId }),
  });
}

export function linkYahooLeague(input: {
  externalLeagueId: string;
  accessToken: string;
  tokenSecret: string;
  sessionHandle?: string;
}): Promise<{ link: LeagueLink }> {
  return authFetch('/league-links', {
    method: 'POST',
    body: JSON.stringify({
      platform: 'yahoo',
      externalLeagueId: input.externalLeagueId,
      credentials: {
        accessToken: input.accessToken,
        tokenSecret: input.tokenSecret,
        sessionHandle: input.sessionHandle || null,
        expiresAt: null,
      },
    }),
  });
}

export function disconnectLeagueLink(linkId: string): Promise<null> {
  return authFetch(`/league-links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
}
