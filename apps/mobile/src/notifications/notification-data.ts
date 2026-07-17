export function draftIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidate = data as { type?: unknown; draftId?: unknown };
  return candidate.type === 'draft.on_the_clock' && typeof candidate.draftId === 'string'
    ? candidate.draftId
    : null;
}
