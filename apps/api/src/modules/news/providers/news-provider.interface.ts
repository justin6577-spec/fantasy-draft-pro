import type { NewsArticle } from '@fantasy-draft/shared';

/**
 * Internal NewsProvider interface (design.md Decision #2 / tasks.md #9.1).
 * A concrete vendor (RotoWire, SportRadar, etc.) can be plugged in behind
 * this interface without changing the summarizer or notification pipeline.
 * No vendor has been selected yet - this is a procurement dependency, not
 * an engineering blocker. `MockNewsProvider` is used for local dev/tests.
 */
export interface NewsProvider {
  fetchRecentByPlayer(playerId: string): Promise<NewsArticle[]>;
  fetchRecent(sinceIso: string): Promise<NewsArticle[]>;
}
