export type NewsImpactTag =
  | 'out'
  | 'questionable'
  | 'role_change'
  | 'breakout'
  | 'neutral';

export interface NewsArticle {
  id: string;
  playerId: string;
  sourceUrl: string;
  publishedAt: string;
  rawText: string;
}

export interface CitedSource {
  url: string;
  publishedAt: string;
}

export interface NewsSummary {
  id: string;
  articleClusterId: string;
  playerId: string;
  summaryText: string;
  impactTag: NewsImpactTag;
  citedSources: CitedSource[];
  generatedAt: string;
}

export type NewsSummaryResponse =
  | { status: 'ok'; summary: NewsSummary }
  | { status: 'no_recent_news'; playerId: string };
