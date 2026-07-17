export type NFLGameStatus = 'pre_game' | 'in_progress' | 'halftime' | 'final' | 'postponed' | 'cancelled';

export interface NFLGame {
  gameId: string;
  week: number;
  season: string;
  status: NFLGameStatus;
  quarter: number | null;
  clock: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeRecord: string | null;
  awayRecord: string | null;
  venue: string | null;
  startTime: string;
}

export interface NFLPlayerGameStats {
  playerId: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
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
}

export interface NFLWeekScores {
  season: string;
  week: number;
  weekCompleted: boolean;
  games: NFLGame[];
  topPerformers: NFLPlayerGameStats[];
}

export interface NFLState {
  season: string;
  week: number;
  seasonType: 'pre' | 'regular' | 'post';
  weekStarted: boolean;
  weekCompleted: boolean;
}
