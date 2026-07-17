import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, radii, spacing, typography } from '@/theme/theme';

interface Game {
  gameId: string;
  week: number;
  season: string;
  status: string;
  quarter: number | null;
  clock: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeRecord: string | null;
  awayRecord: string | null;
  venue: string | null;
  startTime: string;
}

interface NFLState {
  season: string;
  week: number;
  seasonType: string;
  weekStarted: boolean;
  weekCompleted: boolean;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

function statusLabel(status: string): string {
  switch (status) {
    case 'pre_game': return 'UPCOMING';
    case 'in_progress': return 'LIVE';
    case 'halftime': return 'HALFTIME';
    case 'final': return 'FINAL';
    default: return status.toUpperCase();
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'in_progress': case 'halftime': return colors.success;
    case 'final': return colors.textSecondary;
    case 'pre_game': return colors.accent;
    default: return colors.textSecondary;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ScoresScreen(): React.JSX.Element {
  const router = useRouter();
  const [nflState, setNflState] = useState<NFLState | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const fetchScores = useCallback(async (week: number) => {
    setLoading(true);
    setError(null);
    try {
      const [stateRes, scoresRes] = await Promise.all([
        fetch(`${API_URL}/nfl/state`),
        fetch(`${API_URL}/nfl/scores?week=${week}`),
      ]);
      if (!stateRes.ok) throw new Error('Unable to load NFL state.');
      const stateData: NFLState = await stateRes.json();
      setNflState(stateData);

      if (!scoresRes.ok) throw new Error('Unable to load scores.');
      const scoresData = await scoresRes.json();
      setGames(scoresData.games ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWeek !== null) {
      fetchScores(selectedWeek);
    }
  }, [selectedWeek, fetchScores]);

  useEffect(() => {
    // Initial load: get current state and show current/last week
    fetch(`${API_URL}/nfl/state`)
      .then((r) => r.json() as Promise<NFLState>)
      .then((state) => {
        setNflState(state);
        const week = state.weekCompleted ? state.week : state.week;
        setSelectedWeek(week);
        setLoading(false);
        return fetch(`${API_URL}/nfl/scores?week=${week}`);
      })
      .then((r) => r.json())
      .then((data) => setGames(data.games ?? []))
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
        setLoading(false);
      });
  }, []);

  const weekOptions = nflState
    ? Array.from({ length: Math.max(1, nflState.week) }, (_, i) => i + 1)
    : [];

  const renderGame = ({ item }: { item: Game }) => {
    const isLive = item.status === 'in_progress' || item.status === 'halftime';
    const isFinal = item.status === 'final';
    const showClock = isLive || isFinal;

    return (
      <Pressable
        onPress={() => router.push(`/game/${item.gameId}`)}
        style={({ pressed }) => [styles.gameCard, pressed && styles.gameCardPressed]}
      >
        <View style={styles.gameHeader}>
          <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
              {statusLabel(item.status)}
            </Text>
          </View>
          {showClock ? (
            <Text style={styles.clock}>
              {isFinal ? 'Final' : item.quarter ? `Q${item.quarter} ${item.clock ?? ''}` : ''}
            </Text>
          ) : (
            <Text style={styles.clock}>{formatTime(item.startTime)}</Text>
          )}
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.teamBlock}>
            <Text style={[styles.teamName, item.awayScore > item.homeScore && isFinal ? styles.winner : null]}>
              {item.awayTeam}
            </Text>
            <Text style={[styles.teamRecord, isFinal && item.awayRecord ? null : null]}>
              {item.awayRecord ?? ''}
            </Text>
          </View>
          <Text style={[styles.score, isFinal || isLive ? null : styles.scoreUpcoming]}>
            {isFinal || isLive ? item.awayScore : '-'}
          </Text>
          <Text style={styles.scoreDivider}>vs</Text>
          <Text style={[styles.score, isFinal || isLive ? null : styles.scoreUpcoming]}>
            {isFinal || isLive ? item.homeScore : '-'}
          </Text>
          <View style={styles.teamBlock}>
            <Text style={[styles.teamName, item.homeScore > item.awayScore && isFinal ? styles.winner : null]}>
              {item.homeTeam}
            </Text>
            <Text style={styles.teamRecord}>{item.homeRecord ?? ''}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>NFL Scores</Text>
        {nflState ? (
          <Text style={styles.subtitle}>
            Week {selectedWeek ?? nflState.week} · {nflState.season}
          </Text>
        ) : null}
      </View>

      {weekOptions.length > 0 ? (
        <FlatList
          horizontal
          data={weekOptions}
          keyExtractor={(w) => String(w)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setSelectedWeek(item);
                fetchScores(item);
              }}
              style={[styles.weekChip, selectedWeek === item && styles.weekChipActive]}
            >
              <Text style={[styles.weekText, selectedWeek === item && styles.weekTextActive]}>
                W {item}
              </Text>
            </Pressable>
          )}
          showsHorizontalScrollIndicator={false}
          style={styles.weekStrip}
          contentContainerStyle={styles.weekStripContent}
        />
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.gameId}
          renderItem={renderGame}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                No games scheduled for this week.
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  weekStrip: { marginBottom: spacing.md, maxHeight: 38 },
  weekStripContent: { gap: spacing.xs },
  weekChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weekChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  weekText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  weekTextActive: { color: colors.primary },
  list: { paddingBottom: spacing.xl },
  gameCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  gameCardPressed: { opacity: 0.85 },
  gameHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  clock: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  teamBlock: { flex: 1 },
  teamName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  winner: { color: colors.success },
  teamRecord: { ...typography.caption, color: colors.textSecondary, fontSize: 10, marginTop: 1 },
  score: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'center',
  },
  scoreUpcoming: { color: colors.textSecondary },
  scoreDivider: { ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.sm },
  errorBox: {
    backgroundColor: '#351A22',
    borderColor: colors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: { ...typography.caption, color: '#FFB4B8' },
  emptyBox: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
