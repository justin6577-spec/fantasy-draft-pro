import type { FastifyReply, FastifyRequest } from 'fastify';

/** Route pre-handler for endpoints that require a valid access JWT. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    if (request.user.type !== 'access') {
      throw new Error('Unexpected token type');
    }
  } catch {
    await reply.code(401).send({
      error: 'unauthorized',
      message: 'A valid access token is required',
    });
  }
}
