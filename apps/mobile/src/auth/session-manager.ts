import { AuthTransportError } from './errors';
import type {
  AuthSessionResponse,
  AuthState,
  AuthTransport,
  PersistedSession,
  SessionStorage,
} from './types';

const REFRESH_SAFETY_WINDOW_MS = 60_000;

type Listener = () => void;
type TimerHandle = ReturnType<typeof setTimeout>;

export interface SessionClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

const defaultClock: SessionClock = {
  now: Date.now,
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
};

/**
 * Owns the mobile token lifecycle. All refresh callers share one promise,
 * which is mandatory because backend refresh tokens are single-use.
 */
export class AuthSessionManager {
  private state: AuthState = { status: 'loading', user: null, error: null };
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshToken: string | null = null;
  private refreshTokenExpiresAt: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private bootstrapPromise: Promise<void> | null = null;
  private sessionGeneration = 0;
  private refreshTimer: TimerHandle | null = null;
  private listeners = new Set<Listener>();

  constructor(
    private readonly storage: SessionStorage,
    private readonly transport: AuthTransport,
    private readonly clock: SessionClock = defaultClock,
  ) {}

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async bootstrap(): Promise<void> {
    if (this.bootstrapPromise) return this.bootstrapPromise;
    const promise = this.performBootstrap().finally(() => {
      if (this.bootstrapPromise === promise) this.bootstrapPromise = null;
    });
    this.bootstrapPromise = promise;
    return promise;
  }

  private async performBootstrap(): Promise<void> {
    this.setState({ status: 'loading', user: null, error: null });
    const persisted = await this.storage.load();
    if (!persisted || new Date(persisted.refreshTokenExpiresAt).getTime() <= this.clock.now()) {
      await this.clearLocalSession();
      return;
    }

    this.refreshToken = persisted.refreshToken;
    this.refreshTokenExpiresAt = persisted.refreshTokenExpiresAt;
    this.setState({ status: 'loading', user: null, error: null });

    try {
      await this.refreshAccessToken(true);
    } catch (error) {
      if (!(error instanceof AuthTransportError) || error.status !== 401) {
        this.setState({
          status: 'error',
          user: persisted.user,
          error: 'Unable to restore your session. Check your connection and try again.',
        });
      }
    }
  }

  async signup(email: string, password: string): Promise<void> {
    await this.applySession(await this.transport.signup(email.trim(), password));
  }

  async login(email: string, password: string): Promise<void> {
    await this.applySession(await this.transport.login(email.trim(), password));
  }

  async getValidAccessToken(forceRefresh = false): Promise<string> {
    const isFresh =
      this.accessToken !== null &&
      this.accessTokenExpiresAt - this.clock.now() > REFRESH_SAFETY_WINDOW_MS;
    if (!forceRefresh && isFresh) return this.accessToken as string;
    return this.refreshAccessToken(true);
  }

  async logout(): Promise<void> {
    const token = this.refreshToken;
    this.sessionGeneration += 1;
    await this.clearLocalSession();
    if (token) {
      try {
        await this.transport.logout(token);
      } catch {
        // Local logout must succeed even while offline.
      }
    }
  }

  private async refreshAccessToken(force: boolean): Promise<string> {
    if (!force && this.accessToken) return this.accessToken;
    if (this.refreshPromise) return this.refreshPromise;
    if (!this.refreshToken) {
      await this.clearLocalSession();
      throw new AuthTransportError('No refresh token is available', 401);
    }

    const currentRefreshToken = this.refreshToken;
    const generation = this.sessionGeneration;
    const promise = this.transport
      .refresh(currentRefreshToken)
      .then(async (session) => {
        if (generation !== this.sessionGeneration) {
          throw new Error('Session changed while refresh was in progress');
        }
        await this.applySession(session);
        return session.accessToken;
      })
      .catch(async (error: unknown) => {
        if (error instanceof AuthTransportError && error.status === 401) {
          await this.clearLocalSession();
        }
        throw error;
      })
      .finally(() => {
        if (this.refreshPromise === promise) this.refreshPromise = null;
      });

    this.refreshPromise = promise;
    return promise;
  }

  private async applySession(session: AuthSessionResponse): Promise<void> {
    const persisted: PersistedSession = {
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      user: session.user,
    };

    // Persist the rotated token before exposing the new access token. This
    // prevents an app restart from reusing the now-consumed prior token.
    await this.storage.save(persisted);
    this.refreshToken = session.refreshToken;
    this.refreshTokenExpiresAt = session.refreshTokenExpiresAt;
    this.accessToken = session.accessToken;
    this.accessTokenExpiresAt =
      this.clock.now() + session.accessTokenExpiresInSeconds * 1000;
    this.scheduleRefresh();
    this.setState({ status: 'authenticated', user: session.user, error: null });
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) this.clock.clearTimeout(this.refreshTimer);
    const delay = Math.max(
      1_000,
      this.accessTokenExpiresAt - this.clock.now() - REFRESH_SAFETY_WINDOW_MS,
    );
    this.refreshTimer = this.clock.setTimeout(() => {
      void this.refreshAccessToken(true).catch(() => {
        // A later API request or explicit restore can retry transient errors.
      });
    }, delay);
  }

  private async clearLocalSession(): Promise<void> {
    if (this.refreshTimer) this.clock.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.refreshToken = null;
    this.refreshTokenExpiresAt = null;
    await this.storage.clear();
    this.setState({ status: 'unauthenticated', user: null, error: null });
  }

  private setState(state: AuthState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
