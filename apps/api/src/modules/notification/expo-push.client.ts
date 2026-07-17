import { env } from '../../config/env';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  ttl?: number;
  data?: Record<string, unknown>;
  collapseId?: string;
  tag?: string;
}

export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | {
      status: 'error';
      message: string;
      details?: { error?: string };
    };

interface ExpoPushResponse {
  data?: ExpoPushTicket[] | ExpoPushTicket;
  errors?: Array<{ message?: string; code?: string }>;
}

export class ExpoPushRequestError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'ExpoPushRequestError';
  }
}

export type ExpoPushSender = (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;

/** Sends one Expo batch. Callers keep batches at or below Expo's 100-message limit. */
export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  fetcher: typeof fetch = fetch,
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];
  if (messages.length > 100) {
    throw new ExpoPushRequestError('Expo push batches cannot exceed 100 messages', false, null);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;

  let response: Response;
  try {
    response = await fetcher(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });
  } catch {
    throw new ExpoPushRequestError('Unable to reach Expo Push Service', true, null);
  }

  const payload = (await response.json().catch(() => null)) as ExpoPushResponse | null;
  if (!response.ok) {
    const detail = payload?.errors?.[0]?.message ?? `Expo Push Service returned ${response.status}`;
    throw new ExpoPushRequestError(
      detail,
      response.status === 429 || response.status >= 500,
      response.status,
    );
  }

  const tickets = Array.isArray(payload?.data)
    ? payload.data
    : payload?.data
      ? [payload.data]
      : [];
  if (tickets.length !== messages.length) {
    throw new ExpoPushRequestError('Expo returned an unexpected number of push tickets', true, 200);
  }
  return tickets;
}
