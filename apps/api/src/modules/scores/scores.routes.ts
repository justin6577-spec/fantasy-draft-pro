import type { FastifyInstance } from 'fastify';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

interface SleeperScore {
  away: string;
  home: string;
  week: number;
  season: string;
  status: string;
  home_score: number;
  away_score: number;
  start_time: number;
  quarter: number | null;
  clock: string | null;
  stadium: string | null;
  home_record: string | null;
  away_record: string | null;
}

interface SleeperState {
  season: number;
  week: number;
  season_type: string;
  week_started?: boolean;
  week_completed?: boolean;
}

type SleeperStatsMap = Record<string, Record<string, Record<string, number>>>;

function mapStatus(status: string): string {
  switch (status) {
    case 'pre_game': case 'in_progress': case 'halftime': case 'final':
    case 'complete': case 'postponed': case 'cancelled':
      return status === 'complete' ? 'final' : status;
    default: return status;
  }
}

export async function scoresRoutes(app: FastifyInstance): Promise<void> {
  // GET /nfl/state — current NFL season/week info
  app.get('/nfl/state', async (_request, reply) => {
    try {
      const res = await fetch(`${SLEEPER_BASE}/state/nfl`);
      if (!res.ok) throw new Error('Failed to fetch NFL state');
      const data = (await res.json()) as SleeperState;
      return reply.send({
        season: String(data.season),
        week: data.week,
        seasonType: data.season_type,
        weekStarted: data.week_started ?? false,
        weekCompleted: data.week_completed ?? false,
      });
    } catch {
      return reply.code(502).send({ error: 'Unable to fetch NFL state from external source.' });
    }
  });

  // GET /nfl/scores?week=&season= — scores for a given week
  app.get<{ Querystring: { week?: string; season?: string } }>(
    '/nfl/scores',
    async (request, reply) => {
      try {
        // Get current state first if week/season not specified
        let week = request.query.week;
        let season = request.query.season;

        if (!season || !week) {
          const stateRes = await fetch(`${SLEEPER_BASE}/state/nfl`);
          const state = (await stateRes.json()) as SleeperState;
          season = season ?? String(state.season);
          week = week ?? String(state.week - 1); // show last completed week by default
        }

        const res = await fetch(`${SLEEPER_BASE}/scores/nfl/${season}/${week}`);
        if (!res.ok) throw new Error('Failed to fetch scores');
        const scores = (await res.json()) as SleeperScore[];

        const mapped = scores.map((s) => ({
          gameId: `${s.away}@${s.home}-${s.week}-${s.season}`,
          week: s.week,
          season: s.season,
          status: mapStatus(s.status),
          quarter: s.quarter ?? null,
          clock: s.clock ?? null,
          homeTeam: s.home,
          awayTeam: s.away,
          homeScore: s.home_score ?? 0,
          awayScore: s.away_score ?? 0,
          homeRecord: s.home_record ?? null,
          awayRecord: s.away_record ?? null,
          venue: s.stadium ?? null,
          startTime: new Date(s.start_time * 1000).toISOString(),
        }));

        return reply.send({
          season,
          week: Number(week),
          games: mapped,
        });
      } catch {
        return reply.code(502).send({ error: 'Unable to fetch scores from external source.' });
      }
    },
  );

  // GET /nfl/leaders?position=RB&limit=10 — top performers this week
  app.get<{ Querystring: { position?: string; limit?: string } }>(
    '/nfl/leaders',
    async (request, reply) => {
      try {
        const position = (request.query.position ?? '').toUpperCase();
        const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 10));

        // Get current week
        const stateRes = await fetch(`${SLEEPER_BASE}/state/nfl`);
        const nflState = (await stateRes.json()) as SleeperState;
        const season = String(nflState.season);
        const currentWeek = nflState.week;
        // Stats for the current week (in-progress) or last completed week
        const statsWeek = nflState.week_completed ? currentWeek : Math.max(1, currentWeek - 1);

        const statsRes = await fetch(`${SLEEPER_BASE}/stats/nfl/player/${season}/${statsWeek}?group_by=team`);
        if (!statsRes.ok) throw new Error('Failed to fetch stats');
        const rawStats = (await statsRes.json()) as SleeperStatsMap;

        // Flatten: player_team -> stats map
        const rows: Array<{
          playerId: string;
          name: string;
          position: string;
          team: string;
          passingYards: number;
          passingTDs: number;
          interceptions: number;
          rushingYards: number;
          rushingTDs: number;
          receptions: number;
          receivingYards: number;
          receivingTDs: number;
          fantasyPoints: number;
          fantasyPointsPpr: number;
        }> = [];

        for (const [playerTeamKey, statMap] of Object.entries(rawStats)) {
          // playerTeamKey format: "player_id:team"
          const team = String(playerTeamKey.split(':').pop() ?? '');
          const pposRaw = statMap['player_position']?.['0'];
          const ppos = pposRaw != null ? String(pposRaw) : '';
          const pos = ppos.replace('_POS', '');

          if (position && ppos !== position) continue;

          const recs = statMap['rec']?.['0'] ?? 0;

          const fp = statMap['fantasy_points']?.['0'] ?? 0;
          const fpPpr = statMap['fantasy_points_ppr']?.['0'] ?? 0;

          const pts = (p: string): number => (statMap['pts_' + p]?.['0'] ?? 0) as number;
          const yds = (p: string): number => (statMap['yds_' + p]?.['0'] ?? 0) as number;
          const tds = (p: string): number => (statMap['td_' + p]?.['0'] ?? 0) as number;

          rows.push({
            playerId: String(playerTeamKey.split(':').shift() ?? playerTeamKey),
            name: statMap['player_name']?.['0'] != null ? String(statMap['player_name']['0']) : 'Unknown',
            position: pos || ppos.replace('_POS', ''),
            team,
            passingYards: yds('pass'),
            passingTDs: tds('pass'),
            interceptions: (statMap['int']?.['0'] ?? 0) as number,
            rushingYards: yds('rush'),
            rushingTDs: tds('rush'),
            receptions: recs,
            receivingYards: yds('rec'),
            receivingTDs: tds('rec'),
            fantasyPoints: fp,
            fantasyPointsPpr: fpPpr,
          });
        }

        // Sort by fantasy points descending
        rows.sort((a, b) => b.fantasyPoints - a.fantasyPoints);

        return reply.send({
          season,
          week: statsWeek,
          leaders: rows.slice(0, limit),
        });
      } catch {
        return reply.code(502).send({ error: 'Unable to fetch player stats from external source.' });
      }
    },
  );
}
