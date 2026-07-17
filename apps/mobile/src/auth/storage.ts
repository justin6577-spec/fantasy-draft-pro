import { Platform } from 'react-native';
import type { PersistedSession, SessionStorage } from './types';

const SESSION_KEY = 'fantasy-draft.auth-session.v1';

// Web fallback: localStorage. Native uses expo-secure-store.
const webStore = Platform.OS === 'web' ? {
  get: async (k: string) => localStorage.getItem(k),
  set: async (k: string, v: string) => { localStorage.setItem(k, v); },
  del: async (k: string) => { localStorage.removeItem(k); },
} : null;

async function store() {
  if (webStore) return webStore;
  try {
    const mod = await import('expo-secure-store');
    return {
      get: async (k: string) => mod.getItemAsync(k),
      set: async (k: string, v: string) => mod.setItemAsync(k, v),
      del: async (k: string) => mod.deleteItemAsync(k),
    };
  } catch {
    return webStore!;
  }
}

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedSession>;
  return (
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.refreshTokenExpiresAt === 'string' &&
    typeof candidate.user?.id === 'string' &&
    typeof candidate.user?.email === 'string'
  );
}

/** Stores the rotating refresh token and user metadata in one atomic record. */
export const secureSessionStorage: SessionStorage = {
  async load() {
    const s = await store();
    const encoded = await s.get(SESSION_KEY);
    if (!encoded) return null;

    try {
      const parsed: unknown = JSON.parse(encoded);
      if (isPersistedSession(parsed)) return parsed;
    } catch {
      // Corrupt/legacy records are discarded below.
    }

    await s.del(SESSION_KEY);
    return null;
  },

  async save(session) {
    const s = await store();
    await s.set(SESSION_KEY, JSON.stringify(session));
  },

  async clear() {
    const s = await store();
    await s.del(SESSION_KEY);
  },
};
