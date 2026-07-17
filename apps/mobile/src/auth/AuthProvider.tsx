import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { authSession } from './session';
import type { AuthState } from './types';
import {
  registerPushNotifications,
  unregisterPushNotifications,
} from '@/notifications/push-registration';

interface AuthContextValue {
  state: AuthState;
  login(email: string, password: string): Promise<void>;
  signup(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  retrySession(): Promise<void>;
  getValidAccessToken(forceRefresh?: boolean): Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [state, setState] = useState<AuthState>(authSession.getState());

  useEffect(() => {
    const unsubscribe = authSession.subscribe(() => setState(authSession.getState()));
    void authSession.bootstrap();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (state.status !== 'authenticated') return;

    void registerPushNotifications();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void registerPushNotifications();
    });
    return () => subscription.remove();
  }, [state.status, state.user?.id]);

  const login = useCallback((email: string, password: string) => authSession.login(email, password), []);
  const signup = useCallback(
    (email: string, password: string) => authSession.signup(email, password),
    [],
  );
  const logout = useCallback(async () => {
    await unregisterPushNotifications();
    await authSession.logout();
  }, []);
  const retrySession = useCallback(() => authSession.bootstrap(), []);
  const getValidAccessToken = useCallback(
    (forceRefresh = false) => authSession.getValidAccessToken(forceRefresh),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, signup, logout, retrySession, getValidAccessToken }),
    [state, login, signup, logout, retrySession, getValidAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
