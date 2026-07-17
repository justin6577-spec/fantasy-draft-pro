/**
 * Sleeper League Sync provider — fetches league, draft, and roster data
 * from the public Sleeper API (no auth required for reads).
 *
 * https://docs.sleeper.com/
 */

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

// ── API types ─────────────────────────────────────────────────────

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  starters: string[];
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  status: 'pre_draft' | 'drafting' | 'complete';
  settings: {
    rounds: number;
    pick_timer: number;
  };
  slot_to_roster_id: Record<string, number>;
}

export interface SleeperPick {
  pick_no: number;
  round: number;
  roster_id: number;
  player_id: string;
  player_name?: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  roster_positions: string[];
  scoring_settings?: Record<string, number>;
}

// ── Public API ─────────────────────────────────────────────────────

export async function fetchUserByUsername(username: string): Promise<SleeperUser> {
  const res = await fetch(`${SLEEPER_BASE}/user/${username}`);
  if (!res.ok) throw new Error(`Sleeper user fetch failed: ${res.status}`);
  return res.json() as Promise<SleeperUser>;
}

export async function fetchLeague(leagueId: string): Promise<SleeperLeague> {
  const res = await fetch(`${SLEEPER_BASE}/league/${leagueId}`);
  if (!res.ok) throw new Error(`Sleeper league fetch failed: ${res.status}`);
  return res.json() as Promise<SleeperLeague>;
}

export async function fetchRosters(leagueId: string): Promise<SleeperRoster[]> {
  const res = await fetch(`${SLEEPER_BASE}/league/${leagueId}/rosters`);
  if (!res.ok) throw new Error(`Sleeper rosters fetch failed: ${res.status}`);
  return res.json() as Promise<SleeperRoster[]>;
}

export async function fetchDrafts(leagueId: string): Promise<SleeperDraft[]> {
  const res = await fetch(`${SLEEPER_BASE}/league/${leagueId}/drafts`);
  if (!res.ok) throw new Error(`Sleeper drafts fetch failed: ${res.status}`);
  return res.json() as Promise<SleeperDraft[]>;
}

export async function fetchDraftPicks(draftId: string): Promise<SleeperPick[]> {
  const res = await fetch(`${SLEEPER_BASE}/draft/${draftId}/picks`);
  if (!res.ok) throw new Error(`Sleeper picks fetch failed: ${res.status}`);
  return res.json() as Promise<SleeperPick[]>;
}

// ── Diff helpers ───────────────────────────────────────────────────

export interface NormalizedPick {
  pickIndex: number;
  playerId: string;
  teamId: string;
}

export interface SleeperDraftState {
  draftId: string;
  status: string;
  currentPickIndex: number;
  picks: NormalizedPick[];
}

/** Fetch and normalize a full Sleeper draft state snapshot. */
export async function fetchSleeperDraftState(draftId: string): Promise<SleeperDraftState> {
  const [draft, picks] = await Promise.all([
    fetch(`${SLEEPER_BASE}/draft/${draftId}`).then((r) => r.json()) as Promise<SleeperDraft>,
    fetchDraftPicks(draftId),
  ]);

  // Build slot→roster map to convert roster_id to stable team ID
  const slotToRoster = draft.slot_to_roster_id ?? {};

  return {
    draftId,
    status: draft.status,
    currentPickIndex: picks.length, // picks returned are 1-indexed
    picks: picks.map((p) => ({
      pickIndex: p.pick_no - 1, // normalize to 0-indexed
      playerId: p.player_id,
      teamId: String(slotToRoster[String(p.roster_id)] ?? p.roster_id),
    })),
  };
}

/**
 * Diffs two draft states and returns only the new picks not present in
 * the old state. Both must be sorted by pickIndex.
 */
export function diffSleeperPicks(
  oldState: SleeperDraftState,
  newState: SleeperDraftState,
): NormalizedPick[] {
  const oldIds = new Set(oldState.picks.map((p) => `${p.pickIndex}-${p.playerId}`));
  return newState.picks.filter((p) => !oldIds.has(`${p.pickIndex}-${p.playerId}`));
}
