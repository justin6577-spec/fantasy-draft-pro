import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthError } from './auth.errors';
import { login, logout, refresh, signup } from './auth.service';
import { googleSignIn, appleSignIn } from './auth-social.service';
import { requireAuth } from './auth.guard';

const credentialsSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(512),
});

function sendAuthError(reply: FastifyReply, error: AuthError) {
  if (error.code === 'EMAIL_IN_USE') {
    return reply.code(409).send({ error: 'email_in_use', message: error.message });
  }
  return reply.code(401).send({ error: 'invalid_credentials', message: error.message });
}

/** Email/password account and token lifecycle routes (Requirement 5.1). */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/signup', async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }

    try {
      return reply.code(201).send(await signup(app, parsed.data));
    } catch (error) {
      if (error instanceof AuthError) return sendAuthError(reply, error);
      throw error;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }

    try {
      return reply.send(await login(app, parsed.data));
    } catch (error) {
      if (error instanceof AuthError) return sendAuthError(reply, error);
      throw error;
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }

    try {
      return reply.send(await refresh(app, parsed.data.refreshToken));
    } catch (error) {
      if (error instanceof AuthError) return sendAuthError(reply, error);
      throw error;
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }
    await logout(parsed.data.refreshToken);
    return reply.code(204).send();
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => ({
    id: request.user.sub,
    email: request.user.email,
  }));

  // ── Social sign-in ────────────────────────────────────────────

  const idTokenSchema = z.object({
    idToken: z.string().min(10),
  });

  app.post('/auth/google', async (request, reply) => {
    const parsed = idTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }
    try {
      return reply.send(await googleSignIn(app, parsed.data.idToken));
    } catch (error) {
      if (error instanceof AuthError) return sendAuthError(reply, error);
      throw error;
    }
  });

  app.post('/auth/apple', async (request, reply) => {
    const parsed = idTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.flatten() });
    }
    try {
      return reply.send(await appleSignIn(app, parsed.data.idToken));
    } catch (error) {
      if (error instanceof AuthError) return sendAuthError(reply, error);
      throw error;
    }
  });
}
