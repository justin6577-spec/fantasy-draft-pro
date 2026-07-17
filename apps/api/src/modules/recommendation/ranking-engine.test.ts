import { describe, expect, it } from 'vitest';
import { computeCandidates, type ProjectionRankingRow } from './ranking-engine';

function projection(
  playerId: string,
  position: string,
  rank: number,
  projectedPoints: number,
): ProjectionRankingRow {
  return {
    playerId,
    rank,
    projectedPoints,
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    player: { id: playerId, name: `Player ${playerId}`, position, team: 'TST' },
  };
}

describe('computeCandidates', () => {
  it('filters unavailable players and applies value, scarcity, and roster needs deterministically', () => {
    const projections = [
      projection('drafted-best', 'WR', 1, 340),
      projection('rb-top', 'RB', 2, 300),
      projection('wr-top', 'WR', 3, 290),
      projection('rb-replacement', 'RB', 4, 295),
      projection('wr-replacement', 'WR', 5, 200),
    ];
    const availablePlayerIds = ['rb-top', 'wr-top', 'rb-replacement', 'wr-replacement'];

    const first = computeCandidates({
      projections,
      availablePlayerIds,
      rosterNeeds: { WR: 2, RB: 0 },
    });
    const second = computeCandidates({
      projections: [...projections].reverse(),
      availablePlayerIds: [...availablePlayerIds].reverse(),
      rosterNeeds: { WR: 2, RB: 0 },
    });

    expect(first.map((candidate) => candidate.playerId)).toEqual(
      second.map((candidate) => candidate.playerId),
    );
    expect(first[0]).toMatchObject({ playerId: 'wr-top', fillsRosterNeed: true });
    expect(first.some((candidate) => candidate.playerId === 'drafted-best')).toBe(false);
  });

  it('uses player ID as the final stable tie-break and returns an explicit empty pool without rankings', () => {
    const tied = [
      projection('player-b', 'QB', 1, 250),
      projection('player-a', 'QB', 1, 250),
    ];
    expect(
      computeCandidates({
        projections: tied,
        availablePlayerIds: ['player-b', 'player-a'],
        rosterNeeds: { QB: 1 },
      }).map((candidate) => candidate.playerId),
    ).toEqual(['player-a', 'player-b']);
    expect(computeCandidates({ projections: [], availablePlayerIds: [], rosterNeeds: {} })).toEqual([]);
  });
});
