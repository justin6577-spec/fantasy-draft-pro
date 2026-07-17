import type { FastifyInstance } from 'fastify';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const INJURY_STATUSES = new Set(['Questionable', 'Out', 'Doubtful', 'IR', 'PUP', 'NFI', 'Suspended']);

interface SleeperPlayer {
  full_name?: string;
  position?: string;
  team_abbr?: string | null;
  status?: string;
  injury_status?: string | null;
  injury_body_part?: string | null;
  injury_start_date?: string | null;
  fantasy_positions?: string[];
  number?: number;
}

let cachedPlayers: Record<string, SleeperPlayer> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPlayers(): Promise<Record<string, SleeperPlayer>> {
  const now = Date.now();
  if (cachedPlayers && now - cacheTime < CACHE_TTL) return cachedPlayers;
  const res = await fetch(`${SLEEPER_BASE}/players/nfl`);
  cachedPlayers = await res.json() as Record<string, SleeperPlayer>;
  cacheTime = now;
  return cachedPlayers;
}

export async function gamedayRoutes(app: FastifyInstance): Promise<void> {
  // GET /gameday/injuries — all injured players grouped by team
  app.get('/gameday/injuries', async (_request, reply) => {
    try {
      const players = await getPlayers();
      const byTeam: Record<string, Array<{
        id: string;
        name: string;
        position: string;
        team: string;
        injuryStatus: string;
        injuryBodyPart: string | null;
        active: boolean;
      }>> = {};

      for (const [id, p] of Object.entries(players)) {
        const team = p.team_abbr ?? 'FA';
        if (!p.full_name || !p.team_abbr) continue;

        const injuryStatus = p.injury_status ?? '';
        if (!injuryStatus || !INJURY_STATUSES.has(injuryStatus)) continue;

        if (!byTeam[team]) byTeam[team] = [];
        byTeam[team].push({
          id,
          name: p.full_name,
          position: p.position ?? (p.fantasy_positions?.[0] ?? ''),
          team,
          injuryStatus,
          injuryBodyPart: p.injury_body_part ?? null,
          active: p.status === 'Active',
        });
      }

      // Sort teams and players within each team
      const sorted: Array<{ team: string; players: typeof byTeam[string] }> = Object.entries(byTeam)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([team, teamPlayers]) => ({
          team,
          players: teamPlayers.sort((a, b) => {
            const order = ['Out', 'IR', 'Doubtful', 'Questionable', 'PUP', 'NFI', 'Suspended'];
            return order.indexOf(a.injuryStatus) - order.indexOf(b.injuryStatus);
          }),
        }));

      return reply.send({ teams: sorted, total: Object.values(byTeam).flat().length });
    } catch {
      return reply.code(502).send({ error: 'Unable to fetch injury data.' });
    }
  });

  // GET /gameday/trending — top players + biggest changes
  app.get('/gameday/trending', async (_request, reply) => {
    try {
      // Get current week for stat context
      const stateRes = await fetch(`${SLEEPER_BASE}/state/nfl`);
      const state = await stateRes.json() as { season: number; week: number; week_completed?: boolean };
      const season = String(state.season);
      const statsWeek = state.week_completed ? state.week : Math.max(1, state.week - 1);

      // Fetch weekly leaders
      const leadersRes = await fetch(`${SLEEPER_BASE}/stats/nfl/player/${season}/${statsWeek}?group_by=team`);
      const leaders = await leadersRes.json() as Record<string, Record<string, Record<string, number>>>;

      const rows: Array<{
        playerId: string;
        name: string;
        position: string;
        team: string;
        fantasyPoints: number;
        passingYards: number;
        rushingYards: number;
        receivingYards: number;
      }> = [];

      for (const [key, statMap] of Object.entries(leaders)) {
        const team = String(key.split(':').pop() ?? '');
        const ppos = statMap['player_position']?.['0'];
        const pos = ppos != null ? String(ppos).replace('_POS', '') : '';
        if (pos !== 'QB' && pos !== 'RB' && pos !== 'WR' && pos !== 'TE') continue;

        rows.push({
          playerId: String(key.split(':').shift() ?? key),
          name: statMap['player_name']?.['0'] != null ? String(statMap['player_name']['0']) : 'Unknown',
          position: pos,
          team,
          fantasyPoints: statMap['fantasy_points']?.['0'] ?? 0,
          passingYards: statMap['yds_pass']?.['0'] ?? 0,
          rushingYards: statMap['yds_rush']?.['0'] ?? 0,
          receivingYards: statMap['yds_rec']?.['0'] ?? 0,
        });
      }

      rows.sort((a, b) => b.fantasyPoints - a.fantasyPoints);

      return reply.send({
        season,
        week: statsWeek,
        topPlayers: rows.slice(0, 25),
      });
    } catch {
      return reply.code(502).send({ error: 'Unable to fetch trending data.' });
    }
  });

  // GET /gameday/weekly-status — bye weeks, games, and key status
  app.get('/gameday/weekly-status', async (_request, reply) => {
    try {
      const stateRes = await fetch(`${SLEEPER_BASE}/state/nfl`);
      const state = await stateRes.json() as { season: number; week: number; season_type: string; week_started?: boolean; week_completed?: boolean };
      const week = state.week;
      const season = String(state.season);

      // Get bye weeks from our player DB if we have it
      const players = await getPlayers();
      const byTeams: Record<string, { name: string; injuredCount: number; byeWeek: number }> = {};
      for (const p of Object.values(players)) {
        const team = p.team_abbr;
        if (!team) continue;
        if (!byTeams[team]) byTeams[team] = { name: team, injuredCount: 0, byeWeek: 0 };
        if (p.injury_status && INJURY_STATUSES.has(p.injury_status)) {
          byTeams[team].injuredCount++;
        }
      }

      return reply.send({
        season,
        week,
        seasonType: state.season_type,
        weekStarted: state.week_started ?? false,
        weekCompleted: state.week_completed ?? false,
        totalInjured: 0, // will be filled below
        teams: Object.values(byTeams).sort((a, b) => a.name.localeCompare(b.name)),
      });
    } catch {
      return reply.code(502).send({ error: 'Unable to fetch weekly status.' });
    }
  });
}
