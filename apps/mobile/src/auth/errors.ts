export class AuthTransportError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'AuthTransportError';
  }
}
