import { describe, expect, it } from 'vitest';
import type { RecommendationCandidate } from '@fantasy-draft/shared';
import { deriveRosterNeeds, parseLlmDecisions } from './recommendation.service';

const candidates: RecommendationCandidate[] = [
  {
    playerId: 'candidate-a',
    playerName: 'Alpha Runner',
    position: 'RB',
    team: 'AAA',
    rank: 1,
    projectedPoints: 280,
    fillsRosterNeed: true,
  },
  {
    playerId: 'candidate-b',
    playerName: 'Beta Receiver',
    position: 'WR',
    team: 'BBB',
    rank: 2,
    projectedPoints: 270,
    fillsRosterNeed: true,
  },
  {
    playerId: 'candidate-c',
    playerName: 'Gamma Tight End',
    position: 'TE',
    team: 'CCC',
    rank: 3,
    projectedPoints: 240,
    fillsRosterNeed: false,
  },
];

describe('LLM recommendation constraints', () => {
  it('accepts only candidate IDs and enumerated reason codes', () => {
    const valid = JSON.stringify({
      recommendations: candidates.map((candidate) => ({
        playerId: candidate.playerId,
        reasons: ['value', 'projection'],
      })),
    });
    expect(parseLlmDecisions(valid, candidates)?.map((decision) => decision.playerId)).toEqual([
      'candidate-a',
      'candidate-b',
      'candidate-c',
    ]);
  });

  it('rejects an outside player ID, so provider output can never add a player', () => {
    const outsidePlayer = JSON.stringify({
      recommendations: [
        { playerId: 'candidate-a', reasons: ['value'] },
        { playerId: 'candidate-b', reasons: ['projection'] },
        { playerId: 'outside-player', reasons: ['scarcity'] },
      ],
    });
    expect(parseLlmDecisions(outsidePlayer, candidates)).toBeNull();
  });

  it('rejects free-form fields that could smuggle an outside recommendation into prose', () => {
    const freeFormOutsidePlayer = JSON.stringify({
      recommendations: [
        { playerId: 'candidate-a', reasons: ['value'], explanation: 'Draft outside-player.' },
        { playerId: 'candidate-b', reasons: ['projection'] },
        { playerId: 'candidate-c', reasons: ['scarcity'] },
      ],
    });
    expect(parseLlmDecisions(freeFormOutsidePlayer, candidates)).toBeNull();
  });
});

describe('deriveRosterNeeds', () => {
  it('derives fixed and flex needs from authoritative drafted positions', () => {
    expect(
      deriveRosterNeeds(
        { qb: 1, rb: 2, wr: 2, te: 1, flex: 1, k: 1, dst: 1 },
        ['QB', 'RB', 'RB', 'WR'],
      ),
    ).toEqual({ QB: 0, RB: 1, WR: 2, TE: 2, K: 1, DST: 1 });
  });
});
