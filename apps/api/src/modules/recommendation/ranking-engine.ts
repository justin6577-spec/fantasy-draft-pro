import type { RecommendationCandidate } from '@fantasy-draft/shared';

export interface ProjectionRankingRow {
  playerId: string;
  rank: number;
  projectedPoints: number;
  updatedAt: Date;
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
    externalIds?: unknown;
  };
}

export interface RankingEngineInput {
  projections: ProjectionRankingRow[];
  availablePlayerIds: string[];
  rosterNeeds: Record<string, number>;
}

const POSITION_ALIASES: Record<string, string> = {
  DEF: 'DST',
  D: 'DST',
};

const REPLACEMENT_DEPTH: Record<string, number> = {
  QB: 12,
  RB: 30,
  WR: 36,
  TE: 12,
  K: 12,
  DST: 12,
};

const SCARCITY_WEIGHTS: Record<string, number> = {
  QB: 1,
  RB: 1.2,
  WR: 1,
  TE: 1.25,
  K: 0.35,
  DST: 0.35,
};

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return POSITION_ALIASES[normalized] ?? normalized;
}

function replacementPoints(rows: ProjectionRankingRow[], position: string): number {
  const atPosition = rows
    .filter((row) => normalizePosition(row.player.position) === position)
    .sort((left, right) =>
      left.rank - right.rank ||
      right.projectedPoints - left.projectedPoints ||
      left.playerId.localeCompare(right.playerId),
    );
  if (atPosition.length === 0) return 0;
  const replacementIndex = Math.min((REPLACEMENT_DEPTH[position] ?? 12) - 1, atPosition.length - 1);
  return atPosition[replacementIndex]?.projectedPoints ?? 0;
}

/**
 * Ranks only the server-supplied available pool. The score combines value
 * over the currently available replacement player, positional scarcity,
 * and remaining starter/flex needs. Final comparisons always include
 * projection rank and player ID, making equal-score ordering stable.
 */
export function computeCandidates(input: RankingEngineInput): RecommendationCandidate[] {
  if (input.projections.length === 0 || input.availablePlayerIds.length === 0) return [];

  const availableIds = new Set(input.availablePlayerIds);
  const available = input.projections.filter((row) => availableIds.has(row.playerId));
  if (available.length === 0) return [];

  const baselines = new Map<string, number>();
  const positionLeaders = new Map<string, number>();
  for (const row of available) {
    const position = normalizePosition(row.player.position);
    if (!baselines.has(position)) baselines.set(position, replacementPoints(available, position));
    positionLeaders.set(
      position,
      Math.max(positionLeaders.get(position) ?? Number.NEGATIVE_INFINITY, row.projectedPoints),
    );
  }

  const scored = available.map((row) => {
    const position = normalizePosition(row.player.position);
    const baseline = baselines.get(position) ?? 0;
    const valueOverReplacement = row.projectedPoints - baseline;
    const leader = positionLeaders.get(position) ?? row.projectedPoints;
    const availableDrop = Math.max(0, leader - baseline) / Math.max(Math.abs(leader), 1);
    const scarcityMultiplier = (SCARCITY_WEIGHTS[position] ?? 0.8) * (1 + availableDrop);
    const remainingNeed = Math.max(0, input.rosterNeeds[position] ?? 0);
    const needMultiplier = remainingNeed > 0 ? 1 + Math.min(remainingNeed, 3) * 0.18 : 0.72;

    // A small projection component prevents replacement-level players from
    // collapsing into arbitrary ties while VOR remains the dominant signal.
    const score = valueOverReplacement * scarcityMultiplier * needMultiplier + row.projectedPoints * 0.015;

    return { row, position, remainingNeed, score };
  });

  scored.sort((left, right) =>
    right.score - left.score ||
    left.row.rank - right.row.rank ||
    right.row.projectedPoints - left.row.projectedPoints ||
    left.row.playerId.localeCompare(right.row.playerId),
  );

  return scored.map(({ row, position, remainingNeed }, index) => ({
    playerId: row.playerId,
    playerName: row.player.name,
    position,
    team: row.player.team,
    rank: index + 1,
    projectedPoints: row.projectedPoints,
    fillsRosterNeed: remainingNeed > 0,
  }));
}
