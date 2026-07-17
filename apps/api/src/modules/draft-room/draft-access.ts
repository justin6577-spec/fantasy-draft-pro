import { prisma } from '../../lib/prisma';

export class DraftAccessError extends Error {
  constructor(
    message: string,
    public readonly code: 'ACCESS_DENIED' | 'INVALID_PARTICIPANTS',
  ) {
    super(message);
    this.name = 'DraftAccessError';
  }
}

/** Returns the authoritative team ID owned by this user in this draft. */
export async function getParticipantTeamId(
  draftId: string,
  userId: string,
): Promise<string | null> {
  const participant = await prisma.draftParticipant.findUnique({
    where: { draftId_userId: { draftId, userId } },
    select: { teamId: true },
  });
  return participant?.teamId ?? null;
}

export async function requireDraftParticipant(draftId: string, userId: string): Promise<string> {
  const teamId = await getParticipantTeamId(draftId, userId);
  if (!teamId) {
    throw new DraftAccessError('You are not a participant in this draft', 'ACCESS_DENIED');
  }
  return teamId;
}
