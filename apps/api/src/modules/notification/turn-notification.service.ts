import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  ExpoPushRequestError,
  sendExpoPushMessages,
  type ExpoPushSender,
  type ExpoPushTicket,
} from './expo-push.client';

const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 60_000;

export interface EnqueueTurnNotificationInput {
  draftId: string;
  pickIndex: number;
  teamId: string;
  clockSeconds: number;
}

/** Enqueues exactly one logical alert in the same transaction as the turn. */
export async function enqueueTurnNotification(
  tx: Prisma.TransactionClient,
  input: EnqueueTurnNotificationInput,
): Promise<void> {
  const participant = await tx.draftParticipant.findUnique({
    where: { draftId_teamId: { draftId: input.draftId, teamId: input.teamId } },
    select: { userId: true },
  });
  if (!participant) return;

  await tx.turnNotificationOutbox.upsert({
    where: {
      draftId_pickIndex_userId: {
        draftId: input.draftId,
        pickIndex: input.pickIndex,
        userId: participant.userId,
      },
    },
    create: {
      draftId: input.draftId,
      pickIndex: input.pickIndex,
      userId: participant.userId,
      expiresAt: new Date(Date.now() + Math.max(1, input.clockSeconds) * 1000),
    },
    update: {},
  });
}

export interface ProcessTurnNotificationOptions {
  limit?: number;
  now?: Date;
  sender?: ExpoPushSender;
}

/** Claims and sends pending outbox records without blocking draft transitions. */
export async function processTurnNotificationOutbox(
  options: ProcessTurnNotificationOptions = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 20;
  const sender = options.sender ?? sendExpoPushMessages;

  await prisma.turnNotificationOutbox.updateMany({
    where: {
      status: 'processing',
      updatedAt: { lt: new Date(now.getTime() - STALE_PROCESSING_MS) },
      expiresAt: { gt: now },
    },
    data: {
      status: 'failed',
      nextAttemptAt: now,
      lastError: 'Notification worker interrupted during delivery',
    },
  });
  await prisma.turnNotificationOutbox.updateMany({
    where: {
      status: { in: ['pending', 'processing', 'failed'] },
      expiresAt: { lte: now },
    },
    data: { status: 'skipped', lastError: 'Turn expired before delivery' },
  });

  const candidates = await prisma.turnNotificationOutbox.findMany({
    where: {
      status: { in: ['pending', 'failed'] },
      attempts: { lt: MAX_ATTEMPTS },
      nextAttemptAt: { lte: now },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  let processed = 0;
  for (const candidate of candidates) {
    const claimed = await prisma.turnNotificationOutbox.updateMany({
      where: {
        id: candidate.id,
        status: { in: ['pending', 'failed'] },
        attempts: { lt: MAX_ATTEMPTS },
        nextAttemptAt: { lte: now },
        expiresAt: { gt: now },
      },
      data: { status: 'processing', attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    processed += 1;
    await deliverClaimedNotification(candidate.id, sender, now);
  }
  return processed;
}

async function deliverClaimedNotification(
  notificationId: string,
  sender: ExpoPushSender,
  now: Date,
): Promise<void> {
  const notification = await prisma.turnNotificationOutbox.findUnique({
    where: { id: notificationId },
    include: {
      user: {
        select: {
          pushTokens: {
            where: { enabled: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
  if (!notification || notification.status !== 'processing') return;

  const tokens = notification.user.pushTokens.slice(0, 100);
  if (tokens.length === 0) {
    await prisma.turnNotificationOutbox.update({
      where: { id: notification.id },
      data: { status: 'skipped', lastError: 'No enabled push token' },
    });
    return;
  }

  const ttl = Math.max(1, Math.floor((notification.expiresAt.getTime() - now.getTime()) / 1000));
  try {
    const tickets = await sender(
      tokens.map(({ token }) => ({
        to: token,
        title: "You're on the clock",
        body: 'Your fantasy draft is waiting for your pick.',
        sound: 'default',
        priority: 'high',
        channelId: 'draft-turns',
        ttl,
        collapseId: `draft-turn-${notification.draftId}`,
        tag: `draft-turn-${notification.draftId}`,
        data: {
          type: 'draft.on_the_clock',
          draftId: notification.draftId,
          pickIndex: notification.pickIndex,
          route: `/draft/${notification.draftId}`,
        },
      })),
    );

    await disableUnregisteredTokens(tokens, tickets);
    const successfulTicketIds = tickets.flatMap((ticket) =>
      ticket.status === 'ok' ? [ticket.id] : [],
    );
    if (successfulTicketIds.length > 0) {
      await prisma.turnNotificationOutbox.update({
        where: { id: notification.id },
        data: {
          status: 'sent',
          expoTicketIds: successfulTicketIds,
          sentAt: new Date(),
          lastError: null,
        },
      });
      return;
    }

    const messages = tickets.flatMap((ticket) =>
      ticket.status === 'error' ? [ticket.message] : [],
    );
    await markFailedOrSkipped(
      notification.id,
      notification.attempts,
      notification.expiresAt,
      messages.join('; ') || 'Expo rejected every push message',
      now,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Expo push error';
    const retryable = !(error instanceof ExpoPushRequestError) || error.retryable;
    if (!retryable) {
      await prisma.turnNotificationOutbox.update({
        where: { id: notification.id },
        data: { status: 'skipped', lastError: message },
      });
      return;
    }
    await markFailedOrSkipped(
      notification.id,
      notification.attempts,
      notification.expiresAt,
      message,
      now,
    );
  }
}

async function disableUnregisteredTokens(
  tokens: Array<{ id: string }>,
  tickets: ExpoPushTicket[],
): Promise<void> {
  const ids = tickets.flatMap((ticket, index) =>
    ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
      ? [tokens[index]?.id]
      : [],
  ).filter((id): id is string => Boolean(id));
  if (ids.length > 0) {
    await prisma.pushToken.updateMany({ where: { id: { in: ids } }, data: { enabled: false } });
  }
}

async function markFailedOrSkipped(
  notificationId: string,
  attempts: number,
  expiresAt: Date,
  lastError: string,
  now: Date,
): Promise<void> {
  const backoffSeconds = Math.min(60, 2 ** Math.max(1, attempts));
  const nextAttemptAt = new Date(now.getTime() + backoffSeconds * 1000);
  const exhausted = attempts >= MAX_ATTEMPTS || nextAttemptAt >= expiresAt;
  await prisma.turnNotificationOutbox.update({
    where: { id: notificationId },
    data: {
      status: exhausted ? 'skipped' : 'failed',
      nextAttemptAt,
      lastError,
    },
  });
}
