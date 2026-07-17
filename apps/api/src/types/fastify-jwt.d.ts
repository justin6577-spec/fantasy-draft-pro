import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      type: 'access';
    };
    user: {
      sub: string;
      email: string;
      type: 'access';
      iat: number;
      exp: number;
    };
  }
}
