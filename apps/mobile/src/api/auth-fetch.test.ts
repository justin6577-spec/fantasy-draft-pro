import { describe, expect, it, vi } from 'vitest';
import { createAuthenticatedFetch, type AccessTokenProvider, type FetchLike } from './auth-fetch';

describe('createAuthenticatedFetch', () => {
  it('forces one refresh and retries once after a 401', async () => {
    const tokenProvider: AccessTokenProvider = {
      getValidAccessToken: vi.fn(async (forceRefresh = false) =>
        forceRefresh ? 'fresh-token' : 'expired-token',
      ),
    };
    const fetcher = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const authFetch = createAuthenticatedFetch(tokenProvider, fetcher);

    const result = await authFetch('https://api.example.test/drafts/1');

    expect(result.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(tokenProvider.getValidAccessToken).toHaveBeenNthCalledWith(1, false);
    expect(tokenProvider.getValidAccessToken).toHaveBeenNthCalledWith(2, true);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer expired-token',
    );
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer fresh-token',
    );
  });

  it('never retries more than once when the retried response is also unauthorized', async () => {
    const tokenProvider: AccessTokenProvider = {
      getValidAccessToken: vi.fn(async (forceRefresh = false) =>
        forceRefresh ? 'fresh-token' : 'expired-token',
      ),
    };
    const fetcher = vi.fn<FetchLike>().mockResolvedValue(new Response(null, { status: 401 }));
    const authFetch = createAuthenticatedFetch(tokenProvider, fetcher);

    const result = await authFetch('https://api.example.test/drafts/1');

    expect(result.status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(tokenProvider.getValidAccessToken).toHaveBeenCalledTimes(2);
  });
});
