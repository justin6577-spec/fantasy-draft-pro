export type DraftStatus = 'scheduled' | 'in_progress' | 'paused' | 'completed';

export type PickSource = 'manual' | 'auto' | 'skip';

export interface DraftSettings {
  pickClockSeconds: number;
  autoPickOnExpiry: boolean;
  rounds: number;
}

export interface Draft {
  id: string;
  leagueId: string;
  order: string[]; // team IDs in draft order
  currentPickIndex: number;
  clockSecondsRemaining: number;
  status: DraftStatus;
  settings: DraftSettings;
}

export interface Pick {
  id: string;
  draftId: string;
  pickIndex: number;
  teamId: string;
  playerId: string;
  madeAt: string;
  source: PickSource;
}

/**
 * WebSocket event contract shared between the API and mobile client.
 * All draft sources (native, Sleeper, Yahoo) are normalized into these events.
 */
export interface DraftStateSnapshot {
  draft: Draft;
  picks: Pick[];
  syncStatus: 'live' | 'synced';
  lastSyncedAt: string | null;
}

export interface PickMadeEvent {
  type: 'pick.made';
  draftId: string;
  pick: Pick;
}

export interface TurnChangedEvent {
  type: 'turn.changed';
  draftId: string;
  currentPickIndex: number;
  onTheClockTeamId: string;
  clockSecondsRemaining: number;
}

export interface ClockTickEvent {
  type: 'clock.tick';
  draftId: string;
  clockSecondsRemaining: number;
}

export interface DraftCompletedEvent {
  type: 'draft.completed';
  draftId: string;
}

export interface PickRejectedEvent {
  type: 'pick.rejected';
  draftId: string;
  reason: 'PICK_ALREADY_TAKEN' | 'NOT_YOUR_TURN' | 'INVALID_PLAYER';
  snapshot: DraftStateSnapshot;
}

export type DraftEvent =
  | PickMadeEvent
  | TurnChangedEvent
  | ClockTickEvent
  | DraftCompletedEvent
  | PickRejectedEvent;

export interface PickSubmitRequest {
  draftId: string;
  playerId: string;
  lastKnownPickIndex: number;
}
