import { secureSessionStorage } from './storage';
import { AuthSessionManager } from './session-manager';
import { authTransport } from './transport';

export const authSession = new AuthSessionManager(secureSessionStorage, authTransport);
