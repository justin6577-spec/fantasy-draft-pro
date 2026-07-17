export interface RecommendationCandidate {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  rank: number;
  projectedPoints: number;
  fillsRosterNeed: boolean;
}

export interface RecommendationReasoning {
  playerId: string;
  explanation: string;
}

export interface RecommendationResponse {
  draftId: string;
  pickIndex: number;
  candidates: RecommendationCandidate[];
  reasoning: RecommendationReasoning[];
  degraded: boolean;
}
