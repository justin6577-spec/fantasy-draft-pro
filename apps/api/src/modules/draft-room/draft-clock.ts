import { redis } from '../../lib/redis';

/**
 * Redis-backed draft clock. Deliberately NOT an in-process setTimeout/
 * setInterval, so the countdown survives an API restart/redeploy
 * (design.md "1. Draft Room Service", Req 3.4/3.5).
 *
 * The "deadline" (epoch ms when the current pick's clock expires) is the
 * single source of truth; remaining seconds are always derived from it
 * rather than decremented in memory, so multiple API instances agree.
 */
const clockKeyFor = (draftId: string): string => `draft:${draftId}:clock`;

export async function startClock(draftId: string, seconds: number): Promise<number> {
  const deadline = Date.now() + seconds * 1000;
  await redis.set(clockKeyFor(draftId), deadline.toString());
  return deadline;
}

export async function getRemainingSeconds(draftId: string): Promise<number | null> {
  const deadline = await redis.get(clockKeyFor(draftId));
  if (!deadline) return null;
  const remainingMs = Number(deadline) - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export async function clearClock(draftId: string): Promise<void> {
  await redis.del(clockKeyFor(draftId));
}

export async function isExpired(draftId: string): Promise<boolean> {
  const remaining = await getRemainingSeconds(draftId);
  return remaining !== null && remaining <= 0;
}
