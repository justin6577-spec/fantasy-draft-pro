export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresAt: string;
  user: AuthUser;
}

export interface PersistedSession {
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: AuthUser;
}

export type AuthState =
  | { status: 'loading'; user: null; error: null }
  | { status: 'unauthenticated'; user: null; error: null }
  | { status: 'authenticated'; user: AuthUser; error: null }
  | { status: 'error'; user: AuthUser | null; error: string };

export interface SessionStorage {
  load(): Promise<PersistedSession | null>;
  save(session: PersistedSession): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthTransport {
  signup(email: string, password: string): Promise<AuthSessionResponse>;
  login(email: string, password: string): Promise<AuthSessionResponse>;
  refresh(refreshToken: string): Promise<AuthSessionResponse>;
  logout(refreshToken: string): Promise<void>;
  googleSignIn(idToken: string): Promise<AuthSessionResponse>;
  appleSignIn(idToken: string): Promise<AuthSessionResponse>;
}
