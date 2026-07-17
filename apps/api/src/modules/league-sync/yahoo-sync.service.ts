/**
 * Yahoo sync service — manages Yahoo OAuth token lifecycle and
 * league import. Follows the same pattern as sleeper-sync.service.ts
 * but with OAuth-based authentication.
 */

import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import {
  getRequestToken,
  exchangeAccessToken,
  fetchYahooLeagues,
  type YahooOAuthTokens,
} from './providers/yahoo.provider';
import { encryptYahooCredentials } from '../league-link/league-link.crypto';

/** Returns the Yahoo OAuth authorization URL for the initial handoff. */
export async function startYahooOAuth(): Promise<{ authUrl: string; state: string }> {
  const { requestTokenSecret, authUrl } = await getRequestToken();
  // Store the request token secret temporarily (hash it so we can verify the callback)
  const state = requestTokenSecret;
  return { authUrl, state };
}

/** Completes the Yahoo OAuth flow and stores the access token. */
export async function completeYahooOAuth(
  userId: string,
  requestToken: string,
  requestTokenSecret: string,
  verifier: string,
  _io: SocketIOServer | null,
): Promise<{ leagues: number }> {
  const tokens = await exchangeAccessToken(requestToken, requestTokenSecret, verifier);

  // Encrypt tokens before any database write. Storage is rejected when no key is configured.
  const credentialsEnc = encryptYahooCredentials(tokens);

  // Fetch the user's Yahoo leagues
  const leagues = await fetchYahooLeagues(tokens);
  let imported = 0;

  for (const league of leagues) {
    // Check if already linked
    const existing = await prisma.leagueLink.findFirst({
      where: { userId, platform: 'yahoo', externalLeagueId: league.league_key },
    });
    if (existing) continue;

    // Create league link + league
    const leagueRecordId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.league.create({
        data: {
          id: leagueRecordId,
          name: league.name,
          platform: 'yahoo',
          seasonId: league.season,
          scoringSettings: {},
          rosterSettings: {},
        },
      });

      await tx.leagueLink.create({
        data: {
          userId,
          platform: 'yahoo',
          externalLeagueId: league.league_key,
          credentialsEnc,
          status: 'active',
          leagueId: leagueRecordId,
        },
      });
    });

    imported++;
  }

  return { leagues: imported };
}

/** Refreshes Yahoo tokens if expired. Yahoo OAuth 1.0a tokens don't
 *  auto-refresh; the session_handle allows issuing a new access token
 *  pair if `oauth_session_handle` was returned. */
export async function refreshYahooTokens(
  linkId: string,
  tokens: YahooOAuthTokens,
): Promise<YahooOAuthTokens> {
  if (tokens.expiresAt && tokens.expiresAt > Date.now()) {
    return tokens; // not expired
  }

  // Re-issue via session handle if available
  if (!tokens.sessionHandle) {
    throw new Error('Yahoo token expired and no session handle available — re-auth required');
  }

  const url = 'https://api.login.yahoo.com/oauth/v2/get_access_token';
  const params: Record<string, string> = {
    oauth_consumer_key: env.YAHOO_CLIENT_ID ?? '',
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    oauth_session_handle: tokens.sessionHandle,
    oauth_token: tokens.accessToken,
  };

  const baseString = `POST&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&'),
  )}`;
  const signingKey = `${encodeURIComponent(env.YAHOO_CLIENT_SECRET ?? '')}&${encodeURIComponent(tokens.tokenSecret)}`;
  const sig = createHmac('sha1', signingKey).update(baseString).digest('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'OAuth ' + Object.entries({ ...params, oauth_signature: sig })
        .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
        .join(', '),
    },
  });

  const text = await res.text();
  const parsed = Object.fromEntries(new URLSearchParams(text));
  if (!parsed.oauth_token) throw new Error(`Yahoo token refresh failed: ${text}`);

  const newTokens: YahooOAuthTokens = {
    accessToken: parsed.oauth_token,
    tokenSecret: parsed.oauth_token_secret,
    sessionHandle: parsed.oauth_session_handle ?? tokens.sessionHandle,
    expiresAt: parsed.oauth_expires_in ? Date.now() + parseInt(parsed.oauth_expires_in) * 1000 : null,
  };

  // Update stored credentials using authenticated encryption.
  await prisma.leagueLink.update({
    where: { id: linkId },
    data: { credentialsEnc: encryptYahooCredentials(newTokens) },
  });

  return newTokens;
}
