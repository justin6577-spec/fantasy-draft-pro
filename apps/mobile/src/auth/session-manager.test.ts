import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthTransportError } from './errors';
import { AuthSessionManager } from './session-manager';
import type {
  AuthSessionResponse,
  AuthTransport,
  PersistedSession,
  SessionStorage,
} from './types';

const user = { id: 'user-1', email: 'drafter@example.com' };

function response(refreshToken: string, accessToken = `access-${refreshToken}`): AuthSessionResponse {
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresInSeconds: 900,
    refreshTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    user,
  };
}

function createStorage(initial: PersistedSession | null = null): SessionStorage & {
  value: PersistedSession | null;
} {
  return {
    value: initial,
    async load() {
      return this.value;
    },
    async save(session) {
      this.value = session;
    },
    async clear() {
      this.value = null;
    },
  };
}

function createTransport(overrides: Partial<AuthTransport> = {}): AuthTransport {
  return {
    signup: vi.fn(async () => response('signup-refresh')),
    login: vi.fn(async () => response('login-refresh')),
    refresh: vi.fn(async () => response('rotated-refresh')),
    logout: vi.fn(async () => undefined),
    googleSignIn: vi.fn(async () => response('google-refresh')),
    appleSignIn: vi.fn(async () => response('apple-refresh')),
    ...overrides,
  };
}

describe('AuthSessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores a persisted session once and atomically stores the rotated token', async () => {
    const storage = createStorage({
      refreshToken: 'persisted-refresh',
      refreshTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      user,
    });
    const refresh = vi.fn(async () => response('rotated-refresh'));
    const manager = new AuthSessionManager(storage, createTransport({ refresh }));

    await Promise.all([manager.bootstrap(), manager.bootstrap()]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('persisted-refresh');
    expect(storage.value?.refreshToken).toBe('rotated-refresh');
    expect(manager.getState()).toEqual({ status: 'authenticated', user, error: null });
  });

  it('single-flights concurrent refresh callers so a token is consumed only once', async () => {
    const storage = createStorage();
    let resolveRefresh: ((session: AuthSessionResponse) => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<AuthSessionResponse>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const manager = new AuthSessionManager(storage, createTransport({ refresh }));
    await manager.login(user.email, 'password123');

    const first = manager.getValidAccessToken(true);
    const second = manager.getValidAccessToken(true);
    expect(refresh).toHaveBeenCalledTimes(1);

    resolveRefresh?.(response('next-refresh', 'next-access'));
    await expect(Promise.all([first, second])).resolves.toEqual(['next-access', 'next-access']);
    expect(storage.value?.refreshToken).toBe('next-refresh');
  });

  it('clears local credentials when the backend rejects a refresh token', async () => {
    const storage = createStorage();
    const refresh = vi.fn(async () => {
      throw new AuthTransportError('Refresh token rejected', 401);
    });
    const manager = new AuthSessionManager(storage, createTransport({ refresh }));
    await manager.login(user.email, 'password123');

    await expect(manager.getValidAccessToken(true)).rejects.toMatchObject({ status: 401 });

    expect(storage.value).toBeNull();
    expect(manager.getState()).toEqual({ status: 'unauthenticated', user: null, error: null });
  });

  it('does not restore a session when an in-flight refresh finishes after logout', async () => {
    const storage = createStorage();
    let resolveRefresh: ((session: AuthSessionResponse) => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<AuthSessionResponse>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const manager = new AuthSessionManager(storage, createTransport({ refresh }));
    await manager.login(user.email, 'password123');

    const pendingRefresh = manager.getValidAccessToken(true);
    await manager.logout();
    resolveRefresh?.(response('late-refresh', 'late-access'));

    await expect(pendingRefresh).rejects.toThrow('Session changed');
    expect(storage.value).toBeNull();
    expect(manager.getState()).toEqual({ status: 'unauthenticated', user: null, error: null });
  });
});
