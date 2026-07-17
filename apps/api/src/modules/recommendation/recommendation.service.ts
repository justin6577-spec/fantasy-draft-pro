import { createHash } from 'node:crypto';
import type {
  RecommendationCandidate,
  RecommendationReasoning,
  RecommendationResponse,
} from '@fantasy-draft/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import {
  computeCandidates,
  type ProjectionRankingRow,
  type RankingEngineInput,
} from './ranking-engine';

const CACHE_TTL_SECONDS = 30;
const MAX_CANDIDATES = 10;
const EXPLANATION_COUNT = 3;
const REASON_CODES = ['value', 'projection', 'roster_need', 'scarcity'] as const;
type ReasonCode = (typeof REASON_CODES)[number];

export class RecommendationError extends Error {
  constructor(
    message: string,
    public readonly code: 'DRAFT_NOT_FOUND',
  ) {
    super(message);
    this.name = 'RecommendationError';
  }
}

interface RecommendationContext {
  draftId: string;
  teamId: string;
  pickIndex: number;
  rankingInput: RankingEngineInput;
  stateHash: string;
}

interface LlmDecision {
  playerId: string;
  reasons: ReasonCode[];
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function scoringTypeFrom(settings: unknown): string {
  const record = asRecord(settings);
  return typeof record?.type === 'string' && record.type.trim() ? record.type.trim().toLowerCase() : 'standard';
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === 'DEF' || normalized === 'D' ? 'DST' : normalized;
}

function externalPlayerId(externalIds: unknown, platform: string): string | null {
  const record = asRecord(externalIds);
  const value = record?.[platform];
  return typeof value === 'string' && value ? value : null;
}

export function deriveRosterNeeds(
  rosterSettings: unknown,
  draftedPositions: string[],
): Record<string, number> {
  const settings = asRecord(rosterSettings) ?? {};
  const targets: Record<string, number> = {
    QB: nonNegativeNumber(settings.qb ?? settings.QB),
    RB: nonNegativeNumber(settings.rb ?? settings.RB),
    WR: nonNegativeNumber(settings.wr ?? settings.WR),
    TE: nonNegativeNumber(settings.te ?? settings.TE),
    K: nonNegativeNumber(settings.k ?? settings.K),
    DST: nonNegativeNumber(settings.dst ?? settings.def ?? settings.DST ?? settings.DEF),
  };
  const counts: Record<string, number> = {};
  for (const rawPosition of draftedPositions) {
    const position = normalizePosition(rawPosition);
    counts[position] = (counts[position] ?? 0) + 1;
  }

  const needs: Record<string, number> = {};
  for (const [position, target] of Object.entries(targets)) {
    needs[position] = Math.max(0, target - (counts[position] ?? 0));
  }

  const flexTarget = nonNegativeNumber(settings.flex ?? settings.FLEX);
  const flexPositions = ['RB', 'WR', 'TE'];
  const filledFlex = flexPositions.reduce(
    (total, position) => total + Math.max(0, (counts[position] ?? 0) - targets[position]),
    0,
  );
  const remainingFlex = Math.max(0, flexTarget - filledFlex);
  if (remainingFlex > 0) {
    for (const position of flexPositions) needs[position] += remainingFlex;
  }

  return needs;
}

function stableStateHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function buildRecommendationContext(
  draftId: string,
  teamId: string,
): Promise<RecommendationContext> {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    select: {
      id: true,
      currentPickIndex: true,
      picks: {
        orderBy: { pickIndex: 'asc' },
        select: { pickIndex: true, playerId: true, teamId: true },
      },
      league: {
        select: { platform: true, seasonId: true, scoringSettings: true, rosterSettings: true },
      },
    },
  });
  if (!draft) throw new RecommendationError(`Draft ${draftId} not found`, 'DRAFT_NOT_FOUND');

  const scoringType = scoringTypeFrom(draft.league.scoringSettings);
  const teamPlayerIds = draft.picks
    .filter((pick) => pick.teamId === teamId && pick.playerId !== null)
    .map((pick) => pick.playerId as string);

  const [projectionRows, draftedPlayers] = await Promise.all([
    prisma.projectionRanking.findMany({
      where: { seasonId: draft.league.seasonId, scoringType },
      include: {
        player: { select: { id: true, name: true, position: true, team: true, externalIds: true } },
      },
      orderBy: [{ rank: 'asc' }, { playerId: 'asc' }],
    }),
    teamPlayerIds.length === 0
      ? Promise.resolve([])
      : prisma.player.findMany({
          where: {
            OR: teamPlayerIds.flatMap((playerId) => [
              { id: playerId },
              { externalIds: { path: [draft.league.platform], equals: playerId } },
            ]),
          },
          select: { position: true },
        }),
  ]);

  const projections: ProjectionRankingRow[] = projectionRows;
  const draftedPlayerIds = new Set(
    draft.picks.map((pick) => pick.playerId).filter((playerId): playerId is string => playerId !== null),
  );
  const availablePlayerIds = projections
    .filter((projection) => {
      const externalId = externalPlayerId(projection.player.externalIds, draft.league.platform);
      return !draftedPlayerIds.has(projection.playerId) &&
        (externalId === null || !draftedPlayerIds.has(externalId));
    })
    .map((projection) => projection.playerId);
  const rosterNeeds = deriveRosterNeeds(
    draft.league.rosterSettings,
    draftedPlayers.map((player) => player.position),
  );

  const stateHash = stableStateHash({
    draftId,
    teamId,
    pickIndex: draft.currentPickIndex,
    seasonId: draft.league.seasonId,
    scoringType,
    rosterNeeds,
    picks: draft.picks,
    projections: projections.map((projection) => ({
      playerId: projection.playerId,
      rank: projection.rank,
      projectedPoints: projection.projectedPoints,
      updatedAt: projection.updatedAt.toISOString(),
    })),
    llmEnabled: Boolean(env.OPENAI_API_KEY),
  });

  return {
    draftId,
    teamId,
    pickIndex: draft.currentPickIndex,
    rankingInput: { projections, availablePlayerIds, rosterNeeds },
    stateHash,
  };
}

function deterministicExplanation(candidate: RecommendationCandidate, reasons?: ReasonCode[]): string {
  const selected = new Set(reasons ?? []);
  const details: string[] = [];
  if (selected.has('roster_need') && candidate.fillsRosterNeed) details.push(`fills a ${candidate.position} need`);
  if (selected.has('scarcity')) details.push(`adds positional scarcity value at ${candidate.position}`);
  if (selected.has('projection')) details.push(`projects for ${candidate.projectedPoints.toFixed(1)} points`);
  if (selected.has('value') || details.length === 0) details.push(`is the #${candidate.rank} deterministic value available`);
  return `${candidate.playerName} ${details.join(' and ')}.`;
}

export function parseLlmDecisions(raw: string, candidates: RecommendationCandidate[]): LlmDecision[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  const recommendations = record?.recommendations;
  const expected = candidates.slice(0, EXPLANATION_COUNT);
  if (!Array.isArray(recommendations) || recommendations.length !== expected.length) return null;

  const allowedIds = new Set(expected.map((candidate) => candidate.playerId));
  const seenIds = new Set<string>();
  const decisions: LlmDecision[] = [];
  for (const value of recommendations) {
    const decision = asRecord(value);
    if (!decision || Object.keys(decision).some((key) => key !== 'playerId' && key !== 'reasons')) return null;
    if (typeof decision.playerId !== 'string' || !allowedIds.has(decision.playerId) || seenIds.has(decision.playerId)) return null;
    if (!Array.isArray(decision.reasons) || decision.reasons.length === 0) return null;
    if (!decision.reasons.every((reason): reason is ReasonCode =>
      typeof reason === 'string' && (REASON_CODES as readonly string[]).includes(reason),
    )) return null;
    seenIds.add(decision.playerId);
    decisions.push({ playerId: decision.playerId, reasons: [...new Set(decision.reasons)] });
  }
  if (seenIds.size !== expected.length) return null;
  return decisions;
}

async function requestLlmDecisions(candidates: RecommendationCandidate[], pickIndex: number): Promise<LlmDecision[] | null> {
  if (!env.OPENAI_API_KEY || candidates.length === 0) return null;
  const expected = candidates.slice(0, EXPLANATION_COUNT);
  const prompt = [
    `Choose reason codes for each supplied fantasy football candidate at pick ${pickIndex + 1}.`,
    'Return JSON only: {"recommendations":[{"playerId":"...","reasons":["value"]}]}.',
    `Allowed reason codes: ${REASON_CODES.join(', ')}.`,
    'Include every supplied player exactly once. Never add fields, players, prose, names, or IDs.',
    JSON.stringify(expected.map(({ playerId, position, projectedPoints, fillsRosterNeed }) => ({
      playerId,
      position,
      projectedPoints,
      fillsRosterNeed,
    }))),
  ].join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 250,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as OpenAiResponse;
    const content = data.choices?.[0]?.message?.content;
    return typeof content === 'string' ? parseLlmDecisions(content, candidates) : null;
  } catch {
    return null;
  }
}

function buildReasoning(
  candidates: RecommendationCandidate[],
  decisions: LlmDecision[] | null,
): RecommendationReasoning[] {
  const byId = new Map(decisions?.map((decision) => [decision.playerId, decision.reasons]));
  return candidates.map((candidate) => ({
    playerId: candidate.playerId,
    explanation: deterministicExplanation(candidate, byId.get(candidate.playerId)),
  }));
}

function isRecommendationResponse(value: unknown): value is RecommendationResponse {
  const record = asRecord(value);
  return Boolean(
    record &&
    typeof record.draftId === 'string' &&
    typeof record.pickIndex === 'number' &&
    Array.isArray(record.candidates) &&
    Array.isArray(record.reasoning) &&
    typeof record.degraded === 'boolean',
  );
}

async function readCache(key: string): Promise<RecommendationResponse | null> {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    const parsed: unknown = JSON.parse(cached);
    return isRecommendationResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, response: RecommendationResponse): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(response), 'EX', CACHE_TTL_SECONDS);
  } catch {
    // Recommendations remain available when Redis is temporarily unavailable.
  }
}

export async function getDeterministicCandidates(
  draftId: string,
  teamId: string,
): Promise<{ pickIndex: number; candidates: RecommendationCandidate[] }> {
  const context = await buildRecommendationContext(draftId, teamId);
  return {
    pickIndex: context.pickIndex,
    candidates: computeCandidates(context.rankingInput).slice(0, MAX_CANDIDATES),
  };
}

export async function getRecommendations(draftId: string, teamId: string): Promise<RecommendationResponse> {
  const context = await buildRecommendationContext(draftId, teamId);
  const cacheKey = `recommendations:v2:${draftId}:${teamId}:${context.stateHash}`;
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  const candidates = computeCandidates(context.rankingInput).slice(0, MAX_CANDIDATES);
  const decisions = await requestLlmDecisions(candidates, context.pickIndex);
  const response: RecommendationResponse = {
    draftId,
    pickIndex: context.pickIndex,
    candidates,
    reasoning: buildReasoning(candidates, decisions),
    degraded: decisions === null,
  };
  await writeCache(cacheKey, response);
  return response;
}
