import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { prisma } from '../../lib/prisma';

const app = buildApp();
const testEmails: string[] = [];

function credentials() {
  const email = `auth-${randomUUID()}@auth.test`;
  testEmails.push(email);
  return { email, password: 'Correct-Horse-42!' };
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: testEmails.splice(0) } } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('auth routes', () => {
  it('signs up, verifies the access token, and rejects duplicate email', async () => {
    const input = credentials();
    const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: input });

    expect(signup.statusCode).toBe(201);
    const body = signup.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(body.user.email).toBe(input.email);

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ id: body.user.id, email: input.email });

    const duplicate = await app.inject({ method: 'POST', url: '/auth/signup', payload: input });
    expect(duplicate.statusCode).toBe(409);
  });

  it('logs in with the correct password and rejects an incorrect password', async () => {
    const input = credentials();
    await app.inject({ method: 'POST', url: '/auth/signup', payload: input });

    const invalid = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { ...input, password: 'Definitely-Wrong-42!' },
    });
    expect(invalid.statusCode).toBe(401);

    const valid = await app.inject({ method: 'POST', url: '/auth/login', payload: input });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().accessToken).toEqual(expect.any(String));
  });

  it('rotates refresh tokens and revokes the token family when an old token is reused', async () => {
    const input = credentials();
    const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: input });
    const originalRefreshToken = signup.json().refreshToken as string;

    const rotated = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: originalRefreshToken },
    });
    expect(rotated.statusCode).toBe(200);
    const nextRefreshToken = rotated.json().refreshToken as string;
    expect(nextRefreshToken).not.toBe(originalRefreshToken);

    const reuse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: originalRefreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    const revokedFamily = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: nextRefreshToken },
    });
    expect(revokedFamily.statusCode).toBe(401);
  });

  it('revokes a refresh token on logout', async () => {
    const input = credentials();
    const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: input });
    const refreshToken = signup.json().refreshToken as string;

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken },
    });
    expect(logout.statusCode).toBe(204);

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshAfterLogout.statusCode).toBe(401);
  });
});
