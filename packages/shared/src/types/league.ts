export type LeaguePlatform = 'native' | 'yahoo' | 'sleeper' | 'espn';

export type LeagueLinkStatus = 'active' | 'expired' | 'disconnected';

export interface LeagueLink {
  id: string;
  userId: string;
  platform: LeaguePlatform;
  externalLeagueId: string | null;
  lastSyncedAt: string | null;
  status: LeagueLinkStatus;
}

export interface RosterSettings {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  flex: number;
  k: number;
  dst: number;
  bench: number;
}

export interface ScoringSettings {
  type: 'standard' | 'ppr' | 'half_ppr' | 'custom';
  passingYardsPerPoint?: number;
  passingTdPoints?: number;
  receptionPoints?: number;
  [key: string]: unknown;
}

export interface League {
  id: string;
  name: string;
  platform: LeaguePlatform;
  seasonId: string;
  scoringSettings: ScoringSettings;
  rosterSettings: RosterSettings;
}
