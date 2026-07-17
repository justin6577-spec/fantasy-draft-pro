import type { NewsArticle } from '@fantasy-draft/shared';
import type { NewsProvider } from './news-provider.interface';

/** Local-dev/test stand-in for a real news provider. Returns no articles. */
export class MockNewsProvider implements NewsProvider {
  async fetchRecentByPlayer(_playerId: string): Promise<NewsArticle[]> {
    return [];
  }

  async fetchRecent(_sinceIso: string): Promise<NewsArticle[]> {
    return [];
  }
}
