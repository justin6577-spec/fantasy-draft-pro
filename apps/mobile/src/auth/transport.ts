import { apiUrl } from '@/config/api';
import { AuthTransportError } from './errors';
import type { AuthSessionResponse, AuthTransport } from './types';

export { AuthTransportError };

async function request<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthTransportError('Unable to reach the server', null);
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : 'Authentication request failed';
    throw new AuthTransportError(message, response.status);
  }
  return payload as T;
}

export const authTransport: AuthTransport = {
  signup: (email, password) =>
    request<AuthSessionResponse>('/auth/signup', { email, password }),
  login: (email, password) =>
    request<AuthSessionResponse>('/auth/login', { email, password }),
  refresh: (refreshToken) =>
    request<AuthSessionResponse>('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => request<void>('/auth/logout', { refreshToken }),
  googleSignIn: (idToken) =>
    request<AuthSessionResponse>('/auth/google', { idToken }),
  appleSignIn: (idToken) =>
    request<AuthSessionResponse>('/auth/apple', { idToken }),
};
