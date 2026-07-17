import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { prisma } from '../../lib/prisma';
import type { FastifyInstance } from 'fastify';
import { AuthError } from './auth.errors';
import { createTokenPair } from './auth.service';

// ── Google ──────────────────────────────────────────────────────────

const googleClient = new OAuth2Client();

interface GooglePayload {
  sub: string;       // Google user ID
  email: string;
  email_verified?: boolean;
  name?: string;
}

async function verifyGoogleToken(idToken: string): Promise<GooglePayload> {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) {
    throw new AuthError('Invalid Google token payload', 'INVALID_CREDENTIALS');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
  };
}

// ── Apple ────────────────────────────────────────────────────────────

const appleJWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

interface ApplePayload {
  sub: string;       // Apple user ID
  email?: string;
  email_verified?: 'true' | 'false';
}

async function verifyAppleToken(idToken: string): Promise<ApplePayload> {
  const { payload } = await jwtVerify(idToken, appleJWKS, {
    issuer: 'https://appleid.apple.com',
    audience: process.env.APPLE_CLIENT_ID,
    algorithms: ['RS256'],
  });

  if (!payload.sub) {
    throw new AuthError('Invalid Apple token payload', 'INVALID_CREDENTIALS');
  }
  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
    email_verified: payload.email_verified as 'true' | 'false' | undefined,
  };
}

// ── Shared ───────────────────────────────────────────────────────────

type SocialProvider = 'google' | 'apple';

interface SocialUser {
  provider: SocialProvider;
  providerId: string;
  email: string;
}

async function findOrCreateSocialUser(
  app: FastifyInstance,
  social: SocialUser,
) {
  // Look for existing user by the provider-specific identifier stored as
  // `${provider}:${providerId}` in authProviders, or by matching email.
  const providerTag = `${social.provider}:${social.providerId}`;

  let user = await prisma.user.findFirst({
    where: {
      authProviders: { has: providerTag },
    },
    select: { id: true, email: true },
  });

  if (user) {
    // Existing social login — issue tokens
    return createTokenPair(app, user);
  }

  // Check if a user with this email already exists (password or other provider)
  const existingUser = await prisma.user.findUnique({
    where: { email: social.email },
    select: { id: true, email: true, authProviders: true },
  });

  if (existingUser) {
    // Link this social provider to the existing account
    if (!existingUser.authProviders.includes(providerTag)) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { authProviders: { push: providerTag } },
      });
    }
    return createTokenPair(app, { id: existingUser.id, email: existingUser.email });
  }

  // No existing user — create one with this social provider
  const newUser = await prisma.user.create({
    data: {
      email: social.email,
      authProviders: [providerTag],
    },
    select: { id: true, email: true },
  });

  return createTokenPair(app, newUser);
}

// ── Route handlers ──────────────────────────────────────────────────

export async function googleSignIn(app: FastifyInstance, idToken: string) {
  const google = await verifyGoogleToken(idToken);
  return findOrCreateSocialUser(app, {
    provider: 'google',
    providerId: google.sub,
    email: google.email,
  });
}

export async function appleSignIn(app: FastifyInstance, idToken: string) {
  const apple = await verifyAppleToken(idToken);
  const email = apple.email ?? `${apple.sub}@privaterelay.appleid.com`;
  return findOrCreateSocialUser(app, {
    provider: 'apple',
    providerId: apple.sub,
    email,
  });
}
