import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';

interface PlayersQuery {
  position?: string;
  team?: string;
  search?: string;
  scoring?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const SEASON_ID = '2026';

export async function playerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: PlayersQuery }>('/players', async (request, reply) => {
    const {
      position,
      team,
      search,
      scoring = 'half_ppr',
      sort = 'rank',
      page = '1',
      limit = '50',
    } = request.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));

    const where: Record<string, unknown> = {};

    if (position && VALID_POSITIONS.has(position.toUpperCase())) {
      where.position = position.toUpperCase();
    }

    if (team) {
      where.team = team.toUpperCase();
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [total, players] = await Promise.all([
      prisma.player.count({ where }),
      prisma.player.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          rankings: {
            where: { seasonId: SEASON_ID, scoringType: scoring },
            select: { rank: true, projectedPoints: true, adp: true, scoringType: true },
            orderBy: { rank: 'asc' as const },
            take: 1,
          },
        },
        orderBy: sort === 'name' ? { name: 'asc' as const } : { name: 'asc' as const },
      }),
    ]);

    const rows = players.map((player) => {
      const ranking = player.rankings[0];
      return {
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team,
        byeWeek: player.byeWeek,
        rank: ranking?.rank ?? null,
        projectedPoints: ranking?.projectedPoints ?? null,
        adp: ranking?.adp ?? null,
      };
    });

    // Sort by rank after fetching (since rank is in the related table)
    if (sort === 'rank' || sort === 'projectedPoints') {
      rows.sort((a, b) => {
        const aVal = sort === 'projectedPoints' ? (a.projectedPoints ?? 0) : (a.rank ?? 9999);
        const bVal = sort === 'projectedPoints' ? (b.projectedPoints ?? 0) : (b.rank ?? 9999);
        return sort === 'projectedPoints' ? bVal - aVal : aVal - bVal;
      });
    }

    return reply.send({
      players: rows,
      pagination: { page: pageNum, limit: limitNum, total },
    });
  });
}
