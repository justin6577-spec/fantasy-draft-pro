import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { prisma } from '../../lib/prisma';

const app = buildApp();
const userIds: string[] = [];

async function signup() {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email: `push-${randomUUID()}@notifications.test`,
      password: 'Correct-Horse-42!',
    },
  });
  expect(response.statusCode).toBe(201);
  const body = response.json() as { accessToken: string; user: { id: string } };
  userIds.push(body.user.id);
  return body;
}

afterEach(async () => {
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  }
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('push token routes', () => {
  it('requires authentication and validates Expo token input', async () => {
    const unauthenticated = await app.inject({
      method: 'PUT',
      url: '/notifications/push-token',
      payload: {
        token: 'ExpoPushToken[route-test-token]',
        installationId: 'installation-route-test-1',
        platform: 'android',
      },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const account = await signup();
    const invalid = await app.inject({
      method: 'PUT',
      url: '/notifications/push-token',
      headers: { authorization: `Bearer ${account.accessToken}` },
      payload: {
        token: 'not-an-expo-token',
        installationId: 'installation-route-test-1',
        platform: 'android',
      },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('registers one installation and disables only that user binding on logout', async () => {
    const account = await signup();
    const installationId = `installation-${randomUUID()}`;
    const token = `ExpoPushToken[${randomUUID()}]`;

    const registered = await app.inject({
      method: 'PUT',
      url: '/notifications/push-token',
      headers: { authorization: `Bearer ${account.accessToken}` },
      payload: { token, installationId, platform: 'ios' },
    });
    expect(registered.statusCode).toBe(204);
    await expect(prisma.pushToken.findUnique({ where: { installationId } })).resolves.toMatchObject({
      userId: account.user.id,
      token,
      platform: 'ios',
      enabled: true,
    });

    const removed = await app.inject({
      method: 'DELETE',
      url: `/notifications/push-token/${installationId}`,
      headers: { authorization: `Bearer ${account.accessToken}` },
    });
    expect(removed.statusCode).toBe(204);
    await expect(prisma.pushToken.findUnique({ where: { installationId } })).resolves.toMatchObject({
      enabled: false,
    });
  });
});
