import type { DraftSettings } from '@fantasy-draft/shared';
import { prisma } from '../../lib/prisma';
import { toDraft } from './draft-room.mapper';
import { clearClock, startClock } from './draft-clock';
import { DraftAccessError } from './draft-access';
import { enqueueTurnNotification } from '../notification/turn-notification.service';

export interface DraftParticipantInput {
  userId: string;
  teamId: string;
}

export interface CreateDraftInput {
  leagueId: string;
  order: string[];
  participants: DraftParticipantInput[];
  settings: DraftSettings;
  creatorUserId: string;
}

/** Creates a native draft and its authoritative user-to-team mappings. */
export async function createAndStartDraft(input: CreateDraftInput) {
  const participantUserIds = new Set(input.participants.map((entry) => entry.userId));
  const participantTeamIds = new Set(input.participants.map((entry) => entry.teamId));
  const orderTeamIds = new Set(input.order);

  const participantsAreValid =
    participantUserIds.size === input.participants.length &&
    participantTeamIds.size === input.participants.length &&
    input.participants.some((entry) => entry.userId === input.creatorUserId) &&
    [...orderTeamIds].every((teamId) => participantTeamIds.has(teamId)) &&
    [...participantTeamIds].every((teamId) => orderTeamIds.has(teamId));

  if (!participantsAreValid) {
    throw new DraftAccessError(
      'Participants must uniquely map every draft-order team and include the creator',
      'INVALID_PARTICIPANTS',
    );
  }

  const existingUsers = await prisma.user.count({
    where: { id: { in: [...participantUserIds] } },
  });
  if (existingUsers !== participantUserIds.size) {
    throw new DraftAccessError('Every participant must reference an existing user', 'INVALID_PARTICIPANTS');
  }

  const draftRow = await prisma.draft.create({
    data: {
      leagueId: input.leagueId,
      order: input.order,
      currentPickIndex: 0,
      clockSecondsRemaining: input.settings.pickClockSeconds,
      status: 'scheduled',
      settings: input.settings as unknown as object,
      participants: {
        create: input.participants,
      },
    },
  });

  try {
    await startClock(draftRow.id, input.settings.pickClockSeconds);
    const startedDraft = await prisma.$transaction(async (tx) => {
      const updated = await tx.draft.update({
        where: { id: draftRow.id },
        data: { status: 'in_progress' },
      });
      await enqueueTurnNotification(tx, {
        draftId: draftRow.id,
        pickIndex: 0,
        teamId: input.order[0],
        clockSeconds: input.settings.pickClockSeconds,
      });
      return updated;
    });
    return toDraft(startedDraft);
  } catch (error) {
    await clearClock(draftRow.id);
    throw error;
  }
}
