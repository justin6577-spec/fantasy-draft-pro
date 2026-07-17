import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { AuthError } from './auth.errors';

const PASSWORD_HASH_ROUNDS = 12;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresAt: string;
  user: AuthUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function signAccessToken(app: FastifyInstance, user: AuthUser): string {
  return app.jwt.sign({ sub: user.id, email: user.email, type: 'access' });
}

export async function createTokenPair(
  app: FastifyInstance,
  user: AuthUser,
  familyId = randomUUID(),
): Promise<AuthTokens> {
  const refreshToken = generateRefreshToken();
  const expiresAt = refreshExpiry();

  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      expiresAt,
    },
  });

  return {
    accessToken: signAccessToken(app, user),
    refreshToken,
    accessTokenExpiresInSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTokenExpiresAt: expiresAt.toISOString(),
    user,
  };
}

export async function signup(
  app: FastifyInstance,
  input: { email: string; password: string },
): Promise<AuthTokens> {
  const email = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_HASH_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, authProviders: ['password'] },
      select: { id: true, email: true },
    });
    return createTokenPair(app, user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AuthError('An account already exists for this email', 'EMAIL_IN_USE');
    }
    throw error;
  }
}

export async function login(
  app: FastifyInstance,
  input: { email: string; password: string },
): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(input.email) },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AuthError('Email or password is incorrect', 'INVALID_CREDENTIALS');
  }

  return createTokenPair(app, { id: user.id, email: user.email });
}

/**
 * Rotates an opaque refresh token. Only an HMAC-SHA256 hash is persisted.
 * updateMany makes consuming the old session atomic: concurrent refresh
 * attempts can never both win. Reuse of an already-revoked token revokes
 * the entire token family as a defensive response to possible theft.
 */
export async function refresh(app: FastifyInstance, refreshToken: string): Promise<AuthTokens> {
  const tokenHash = hashRefreshToken(refreshToken);
  const existing = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!existing) {
    throw new AuthError('Refresh token is invalid', 'INVALID_REFRESH_TOKEN');
  }

  if (existing.revokedAt) {
    await prisma.refreshSession.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AuthError('Refresh token has already been used', 'INVALID_REFRESH_TOKEN');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    throw new AuthError('Refresh token has expired', 'INVALID_REFRESH_TOKEN');
  }

  const nextRefreshToken = generateRefreshToken();
  const nextExpiresAt = refreshExpiry();

  const consumed = await prisma.$transaction(async (tx) => {
    const updated = await tx.refreshSession.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count !== 1) return false;

    await tx.refreshSession.create({
      data: {
        userId: existing.userId,
        tokenHash: hashRefreshToken(nextRefreshToken),
        familyId: existing.familyId,
        expiresAt: nextExpiresAt,
      },
    });
    return true;
  });

  if (!consumed) {
    throw new AuthError('Refresh token has already been used', 'INVALID_REFRESH_TOKEN');
  }

  const user = existing.user;
  return {
    accessToken: signAccessToken(app, user),
    refreshToken: nextRefreshToken,
    accessTokenExpiresInSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTokenExpiresAt: nextExpiresAt.toISOString(),
    user,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
