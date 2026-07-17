import { authSession } from '@/auth/session';
import { apiUrl } from '@/config/api';
import { createAuthenticatedFetch } from './auth-fetch';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const authenticatedFetch = createAuthenticatedFetch(authSession);

export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await authenticatedFetch(apiUrl(path), { ...init, headers });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}
