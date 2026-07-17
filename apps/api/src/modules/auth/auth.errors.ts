export type AuthErrorCode =
  | 'EMAIL_IN_USE'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
