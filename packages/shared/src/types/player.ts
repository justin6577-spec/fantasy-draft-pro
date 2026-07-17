export type NFLPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

export interface PlayerExternalIds {
  yahoo?: string;
  sleeper?: string;
  espn?: string;
}

export interface Player {
  id: string;
  name: string;
  position: NFLPosition;
  team: string;
  byeWeek: number | null;
  externalIds: PlayerExternalIds;
}

export type ScoringType = 'standard' | 'ppr' | 'half_ppr' | 'custom';

export interface ProjectionRanking {
  playerId: string;
  seasonId: string;
  scoringType: ScoringType;
  rank: number;
  projectedPoints: number;
  adp?: number | null;
  updatedAt: string;
}
