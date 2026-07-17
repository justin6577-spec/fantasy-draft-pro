/**
 * Yahoo Fantasy Sports provider — OAuth 1.0a flow + API client.
 *
 * Yahoo's Fantasy Sports API uses OAuth 1.0a (not OAuth 2.0).
 * The flow is: request_token → user authorizes → access_token.
 *
 * https://developer.yahoo.com/fantasysports/guide/
 */

import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../../../config/env';

const YAHOO_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';
const YAHOO_AUTH_BASE = 'https://api.login.yahoo.com/oauth/v2';

// ── Types ──────────────────────────────────────────────────────────

export interface YahooOAuthTokens {
  accessToken: string;
  tokenSecret: string;
  sessionHandle: string | null;
  expiresAt: number | null;
}

export interface YahooLeague {
  league_key: string;
  league_id: string;
  name: string;
  season: string;
}

export interface YahooTeam {
  team_key: string;
  team_id: number;
  name: string;
}

export interface YahooDraftPick {
  pick: number;
  round: number;
  team_key: string;
  player_key: string;
}

// ── OAuth 1.0a helpers ─────────────────────────────────────────────

function oauthSignature(method: string, url: string, params: Record<string, string>, tokenSecret = ''): string {
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&'),
  )}`;
  const signingKey = `${encodeURIComponent(env.YAHOO_CLIENT_SECRET ?? '')}&${encodeURIComponent(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function oauthParams(tokenSecret = '', token = ''): Record<string, string> {
  const params: Record<string, string> = {
    oauth_consumer_key: env.YAHOO_CLIENT_ID ?? '',
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };
  if (token) params.oauth_token = token;
  return params;
}

function authHeader(params: Record<string, string>, signature: string): string {
  return 'OAuth ' + Object.entries({ ...params, oauth_signature: signature })
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');
}

async function oauthFetch(url: string, method: string, tokenSecret: string, token: string): Promise<any> {
  const params = oauthParams(tokenSecret, token);
  const sig = oauthSignature(method, url, params, tokenSecret);
  const res = await fetch(url, {
    method,
    headers: { Authorization: authHeader(params, sig), Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Yahoo API error ${res.status}: ${await res.text()}`);
  return res.text(); // Yahoo returns XML, caller parses
}

// ── OAuth flow ─────────────────────────────────────────────────────

export async function getRequestToken(): Promise<{ requestToken: string; requestTokenSecret: string; authUrl: string }> {
  const url = `${YAHOO_AUTH_BASE}/get_request_token`;
  const params = {
    ...oauthParams(),
    oauth_callback: env.YAHOO_REDIRECT_URI ?? '',
  };
  const sig = oauthSignature('POST', url, params);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader(params, sig) },
  });
  const text = await res.text();
  const parsed = Object.fromEntries(new URLSearchParams(text));
  if (!parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new Error(`Yahoo request token failed: ${text}`);
  }
  return {
    requestToken: parsed.oauth_token,
    requestTokenSecret: parsed.oauth_token_secret,
    authUrl: `https://api.login.yahoo.com/oauth/v2/request_auth?oauth_token=${parsed.oauth_token}`,
  };
}

export async function exchangeAccessToken(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string,
): Promise<YahooOAuthTokens> {
  const url = `${YAHOO_AUTH_BASE}/get_access_token`;
  const params = {
    ...oauthParams(requestTokenSecret, requestToken),
    oauth_verifier: verifier,
  };
  const sig = oauthSignature('POST', url, params, requestTokenSecret);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader(params, sig) },
  });
  const text = await res.text();
  const parsed = Object.fromEntries(new URLSearchParams(text));
  if (!parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new Error(`Yahoo access token exchange failed: ${text}`);
  }
  return {
    accessToken: parsed.oauth_token,
    tokenSecret: parsed.oauth_token_secret,
    sessionHandle: parsed.oauth_session_handle ?? null,
    expiresAt: parsed.oauth_expires_in ? Date.now() + parseInt(parsed.oauth_expires_in) * 1000 : null,
  };
}

// ── API client ─────────────────────────────────────────────────────

function parseYahooGames(xml: string): YahooLeague[] {
  // Simple regex extraction — in production use a proper XML parser
  const leagues: YahooLeague[] = [];
  const gameRegex = /<game>[\s\S]*?<league_key>([^<]+)<\/league_key>[\s\S]*?<league_id>([^<]+)<\/league_id>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<season>([^<]+)<\/season>[\s\S]*?<\/game>/g;
  let match;
  while ((match = gameRegex.exec(xml)) !== null) {
    leagues.push({ league_key: match[1], league_id: match[2], name: match[3], season: match[4] });
  }
  return leagues;
}

/** Fetches the user's Yahoo game/league list. */
export async function fetchYahooLeagues(tokens: YahooOAuthTokens): Promise<YahooLeague[]> {
  const xml = await oauthFetch(
    `${YAHOO_API_BASE}/game/nfl/leagues?format=xml`,
    'GET',
    tokens.tokenSecret,
    tokens.accessToken,
  );
  return parseYahooGames(xml as string);
}

/** Fetches draft results for a given league. */
export async function fetchYahooDraftResults(
  leagueKey: string,
  tokens: YahooOAuthTokens,
): Promise<YahooDraftPick[]> {
  const xml = await oauthFetch(
    `${YAHOO_API_BASE}/league/${leagueKey}/draftresults?format=xml`,
    'GET',
    tokens.tokenSecret,
    tokens.accessToken,
  ) as string;

  const picks: YahooDraftPick[] = [];
  const pickRegex = /<pick>[\s\S]*?<pick>(\d+)<\/pick>[\s\S]*?<round>(\d+)<\/round>[\s\S]*?<team_key>([^<]+)<\/team_key>[\s\S]*?<player_key>([^<]+)<\/player_key>[\s\S]*?<\/pick>/g;
  let match;
  while ((match = pickRegex.exec(xml)) !== null) {
    picks.push({ pick: parseInt(match[1]), round: parseInt(match[2]), team_key: match[3], player_key: match[4] });
  }
  return picks;
}
