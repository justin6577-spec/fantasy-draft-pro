export interface AccessTokenProvider {
  getValidAccessToken(forceRefresh?: boolean): Promise<string>;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function withBearer(init: RequestInit | undefined, accessToken: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return { ...init, headers };
}

/** Adds auth and retries exactly once after a 401 with a forced refresh. */
export function createAuthenticatedFetch(
  tokenProvider: AccessTokenProvider,
  fetcher: FetchLike = fetch,
): FetchLike {
  return async (input, init) => {
    const firstToken = await tokenProvider.getValidAccessToken(false);
    const firstResponse = await fetcher(input, withBearer(init, firstToken));
    if (firstResponse.status !== 401) return firstResponse;

    const refreshedToken = await tokenProvider.getValidAccessToken(true);
    return fetcher(input, withBearer(init, refreshedToken));
  };
}
