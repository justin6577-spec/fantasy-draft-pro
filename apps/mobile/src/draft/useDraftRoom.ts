import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ClockTickEvent,
  DraftCompletedEvent,
  DraftStateSnapshot,
  Pick,
  PickMadeEvent,
  PickRejectedEvent,
  PickSubmitRequest,
  RecommendationResponse,
  TurnChangedEvent,
} from '@fantasy-draft/shared';
import { authFetch } from '@/api/client';
import {
  createAuthenticatedDraftSocket,
  type AuthenticatedDraftSocket,
} from '@/realtime/draftSocket';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface DraftIdentity {
  draftId: string;
  teamId: string;
}

interface MessagePayload {
  message?: string;
}

export interface DraftRoomModel {
  snapshot: DraftStateSnapshot | null;
  teamId: string | null;
  onTheClockTeamId: string | null;
  isMyTurn: boolean;
  connectionStatus: ConnectionStatus;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  recommendations: RecommendationResponse | null;
  recommendationsLoading: boolean;
  recommendationsError: string | null;
  refreshRecommendations(): void;
  submitPick(playerId: string): void;
}

function mergePicks(current: Pick[], incoming: Pick[]): Pick[] {
  const byIndex = new Map(current.map((pick) => [pick.pickIndex, pick]));
  for (const pick of incoming) byIndex.set(pick.pickIndex, pick);
  return [...byIndex.values()].sort((left, right) => left.pickIndex - right.pickIndex);
}

export function useDraftRoom(draftId: string | undefined): DraftRoomModel {
  const [snapshot, setSnapshot] = useState<DraftStateSnapshot | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [recommendationRefreshVersion, setRecommendationRefreshVersion] = useState(0);
  const socketHandleRef = useRef<AuthenticatedDraftSocket | null>(null);
  const snapshotRef = useRef<DraftStateSnapshot | null>(null);
  const recommendationRequestRef = useRef(0);

  const updateSnapshot = useCallback(
    (updater: (current: DraftStateSnapshot | null) => DraftStateSnapshot | null) => {
      setSnapshot((current) => {
        const next = updater(current);
        snapshotRef.current = next;
        return next;
      });
    },
    [],
  );

  const invalidateRecommendations = useCallback(() => {
    recommendationRequestRef.current += 1;
    setRecommendations(null);
    setRecommendationsError(null);
    setRecommendationRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!draftId) {
      setError('A draft ID is required.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    invalidateRecommendations();
    setRecommendationsLoading(false);
    setLoading(true);
    setError(null);
    setConnectionStatus('connecting');

    const start = async () => {
      try {
        const initial = await authFetch<DraftStateSnapshot>(`/drafts/${encodeURIComponent(draftId)}`);
        if (!cancelled) updateSnapshot(() => initial);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to load the draft.');
        }
      }

      try {
        const handle = await createAuthenticatedDraftSocket();
        if (cancelled) {
          handle.dispose();
          return;
        }
        socketHandleRef.current = handle;
        const { socket } = handle;

        socket.on('connect', () => {
          setConnectionStatus('connected');
          setError(null);
          const picks = snapshotRef.current?.picks ?? [];
          const nextUnknownPickIndex =
            picks.length === 0 ? 0 : Math.max(...picks.map((pick) => pick.pickIndex)) + 1;
          socket.emit('join', { draftId, lastKnownPickIndex: nextUnknownPickIndex });
        });
        socket.on('disconnect', () => {
          setConnectionStatus('disconnected');
          setSubmitting(false);
        });
        socket.on('draft.identity', (identity: DraftIdentity) => setTeamId(identity.teamId));
        socket.on('snapshot', (next: DraftStateSnapshot) => {
          invalidateRecommendations();
          setSubmitting(false);
          updateSnapshot(() => ({
            ...next,
            picks: mergePicks([], next.picks),
          }));
          setLoading(false);
        });
        socket.on('delta', (picks: Pick[]) => {
          if (picks.length > 0) invalidateRecommendations();
          updateSnapshot((current) =>
            current ? { ...current, picks: mergePicks(current.picks, picks) } : current,
          );
        });
        socket.on('pick.made', (event: PickMadeEvent) => {
          invalidateRecommendations();
          setSubmitting(false);
          updateSnapshot((current) =>
            current
              ? { ...current, picks: mergePicks(current.picks, [event.pick]) }
              : current,
          );
        });
        socket.on('turn.changed', (event: TurnChangedEvent) => {
          invalidateRecommendations();
          setSubmitting(false);
          updateSnapshot((current) =>
            current
              ? {
                  ...current,
                  draft: {
                    ...current.draft,
                    currentPickIndex: event.currentPickIndex,
                    clockSecondsRemaining: event.clockSecondsRemaining,
                  },
                }
              : current,
          );
        });
        socket.on('clock.tick', (event: ClockTickEvent) => {
          updateSnapshot((current) =>
            current
              ? {
                  ...current,
                  draft: { ...current.draft, clockSecondsRemaining: event.clockSecondsRemaining },
                }
              : current,
          );
        });
        socket.on('draft.completed', (_event: DraftCompletedEvent) => {
          invalidateRecommendations();
          setRecommendationsLoading(false);
          setSubmitting(false);
          updateSnapshot((current) =>
            current ? { ...current, draft: { ...current.draft, status: 'completed' } } : current,
          );
        });
        socket.on('pick.rejected', (event: PickRejectedEvent) => {
          invalidateRecommendations();
          setSubmitting(false);
          updateSnapshot(() => event.snapshot);
          setError(event.reason.replaceAll('_', ' ').toLowerCase());
        });
        socket.on('draft.access_denied', (payload: MessagePayload) => {
          setLoading(false);
          setError(payload.message ?? 'You do not have access to this draft.');
        });
        socket.on('error', (payload: MessagePayload) => {
          setLoading(false);
          setError(payload.message ?? 'The draft connection reported an error.');
        });
        socket.on('connect_error', (caught: Error) => {
          setConnectionStatus('disconnected');
          setLoading(false);
          if (caught.message !== 'unauthorized') setError(caught.message);
        });

        socket.connect();
      } catch (caught) {
        if (!cancelled) {
          setConnectionStatus('disconnected');
          setLoading(false);
          setError(caught instanceof Error ? caught.message : 'Unable to connect to the draft.');
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      socketHandleRef.current?.dispose();
      socketHandleRef.current = null;
      snapshotRef.current = null;
    };
  }, [draftId, invalidateRecommendations, updateSnapshot]);

  const recommendationStateKey = useMemo(() => {
    if (!snapshot) return null;
    const picks = snapshot.picks
      .map((pick) => `${pick.pickIndex}:${pick.playerId ?? 'skip'}`)
      .join('|');
    return `${snapshot.draft.status}:${snapshot.draft.currentPickIndex}:${picks}`;
  }, [snapshot]);

  useEffect(() => {
    if (!draftId || !recommendationStateKey || snapshot?.draft.status === 'completed') {
      setRecommendations(null);
      setRecommendationsLoading(false);
      setRecommendationsError(null);
      return;
    }

    let cancelled = false;
    const requestId = ++recommendationRequestRef.current;
    setRecommendations(null);
    setRecommendationsLoading(true);
    setRecommendationsError(null);
    void authFetch<RecommendationResponse>(
      `/drafts/${encodeURIComponent(draftId)}/recommendations`,
    )
      .then((response) => {
        if (!cancelled && recommendationRequestRef.current === requestId) {
          setRecommendations(response);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled && recommendationRequestRef.current === requestId) {
          setRecommendationsError(
            caught instanceof Error ? caught.message : 'Unable to load recommended picks.',
          );
        }
      })
      .finally(() => {
        if (!cancelled && recommendationRequestRef.current === requestId) {
          setRecommendationsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draftId, recommendationRefreshVersion, recommendationStateKey, snapshot?.draft.status]);

  const refreshRecommendations = useCallback(() => {
    setRecommendationRefreshVersion((version) => version + 1);
  }, []);

  const onTheClockTeamId = useMemo(() => {
    if (!snapshot || snapshot.draft.status !== 'in_progress') return null;
    return snapshot.draft.order[snapshot.draft.currentPickIndex] ?? null;
  }, [snapshot]);

  const submitPick = useCallback(
    (playerId: string) => {
      const normalizedPlayerId = playerId.trim();
      const handle = socketHandleRef.current;
      const current = snapshotRef.current;
      if (
        !draftId ||
        !normalizedPlayerId ||
        !handle?.socket.connected ||
        !current ||
        !teamId ||
        current.draft.status !== 'in_progress' ||
        current.draft.order[current.draft.currentPickIndex] !== teamId ||
        submitting
      ) {
        return;
      }

      const request: PickSubmitRequest = {
        draftId,
        playerId: normalizedPlayerId,
        lastKnownPickIndex: current.draft.currentPickIndex,
      };
      setSubmitting(true);
      setError(null);
      handle.socket.emit('pick.submit', request);
    },
    [draftId, submitting, teamId],
  );

  return {
    snapshot,
    teamId,
    onTheClockTeamId,
    isMyTurn: Boolean(teamId && teamId === onTheClockTeamId),
    connectionStatus,
    loading,
    submitting,
    error,
    recommendations,
    recommendationsLoading,
    recommendationsError,
    refreshRecommendations,
    submitPick,
  };
}
