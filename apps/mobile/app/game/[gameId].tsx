import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { colors, radii, spacing, typography } from '@/theme/theme';

interface GameDetail {
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
  venue: string | null;
  startTime: string;
  homeStats: PlayerStat[];
  awayStats: PlayerStat[];
}

interface PlayerStat {
  playerId: string;
  name: string;
  position: string;
  team: string;
  passingYards: number;
  passingTDs: number;
  interceptions: number;
  rushingYards: number;
  rushingTDs: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  fantasyPoints: number;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

interface PlayerRowProps {
  stat: PlayerStat;
  isHome: boolean;
}

function PlayerRow({ stat }: PlayerRowProps): React.JSX.Element {
  const hasPassing = stat.passingYards > 0 || stat.passingTDs > 0;
  const hasRushing = stat.rushingYards > 0 || stat.rushingTDs > 0;
  const hasReceiving = stat.receptions > 0 || stat.receivingYards > 0;

  return (
    <View style={styles.playerRow}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>{stat.name}</Text>
        <Text style={styles.playerMeta}>{stat.position} · {stat.team}</Text>
      </View>
      <View style={styles.statsRow}>
        {hasPassing ? (
          <Text style={styles.statCell}>
            {stat.passingYards}-{stat.passingTDs}{stat.interceptions > 0 ? `-${stat.interceptions}` : ''} pass
          </Text>
        ) : null}
        {hasRushing ? (
          <Text style={styles.statCell}>{stat.rushingYards} rush, {stat.rushingTDs} TD</Text>
        ) : null}
        {hasReceiving ? (
          <Text style={styles.statCell}>{stat.receptions} rec, {stat.receivingYards} yds, {stat.receivingTDs} TD</Text>
        ) : null}
        {!hasPassing && !hasRushing && !hasReceiving ? (
          <Text style={styles.statCell}>No stats</Text>
        ) : null}
      </View>
      <Text style={styles.fpText}>{stat.fantasyPoints.toFixed(1)} fp</Text>
    </View>
  );
}

export default function GameDetailScreen(): React.JSX.Element {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHome, setShowHome] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/nfl/scores?gameId=${encodeURIComponent(gameId)}`);
      if (!res.ok) throw new Error('Unable to load game details.');
      // For now, parse the week/season from gameId and get all scores, then filter
      const parts = gameId.split('-');
      const gameWeek = parts[1];
      const gameSeason = parts[2];
      if (!gameWeek || !gameSeason) throw new Error('Invalid game ID');

      const scoresRes = await fetch(`${API_URL}/nfl/scores?week=${gameWeek}&season=${gameSeason}`);
      const scoresData = await scoresRes.json();
      const match = (scoresData.games ?? []).find((g: { gameId: string }) => g.gameId === gameId);
      if (!match) throw new Error('Game not found');

      // Fetch leaders as a stand-in for per-game box score stats
      const leadersRes = await fetch(`${API_URL}/nfl/leaders?limit=20`);
      const leadersData = await leadersRes.json();
      const leaders: PlayerStat[] = leadersData.leaders ?? [];

      setGame({
        ...match,
        homeStats: leaders.filter((p: PlayerStat) => p.team === match.homeTeam).slice(0, 15),
        awayStats: leaders.filter((p: PlayerStat) => p.team === match.awayTeam).slice(0, 15),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => { void fetchDetail(); }, [fetchDetail]);

  const stats = showHome ? game?.homeStats : game?.awayStats;
  const teamLabel = showHome ? game?.homeTeam : game?.awayTeam;
  const teamScore = showHome ? game?.homeScore : game?.awayScore;

  return (
    <Screen>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error || !game ? (
        <Card>
          <Text style={styles.errorText}>{error ?? 'Game not found'}</Text>
        </Card>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.scoreboard}>
            <View style={styles.scoreRow}>
              <View style={styles.teamBlock}>
                <Text style={styles.teamText}>{game.awayTeam}</Text>
                <Text style={styles.scoreText}>{game.awayScore}</Text>
              </View>
              <Text style={styles.scoreDivider}>@</Text>
              <View style={styles.teamBlock}>
                <Text style={styles.teamText}>{game.homeTeam}</Text>
                <Text style={styles.scoreText}>{game.homeScore}</Text>
              </View>
            </View>
            <Text style={styles.statusText}>
              {game.status === 'final' ? 'FINAL' : game.status === 'in_progress' ? `Q${game.quarter} ${game.clock}` : new Date(game.startTime).toLocaleDateString()}
            </Text>
            {game.venue ? <Text style={styles.venueText}>{game.venue}</Text> : null}
          </View>

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setShowHome(false)}
              style={[styles.toggleBtn, !showHome && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, !showHome && styles.toggleTextActive]}>
                {game.awayTeam}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowHome(true)}
              style={[styles.toggleBtn, showHome && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, showHome && styles.toggleTextActive]}>
                {game.homeTeam}
              </Text>
            </Pressable>
          </View>

          <Card style={styles.statsCard}>
            <Text style={styles.sectionTitle}>
              {teamLabel} — Top Performers
            </Text>
            {stats && stats.length > 0 ? (
              stats.map((s) => <PlayerRow key={s.playerId} stat={s} isHome={showHome} />)
            ) : (
              <Text style={styles.muted}>No player stats recorded yet.</Text>
            )}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: spacing.xl },
  scoreboard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  teamBlock: { alignItems: 'center', minWidth: 80 },
  teamText: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  scoreText: { color: colors.textPrimary, fontSize: 40, fontWeight: '800' },
  scoreDivider: { ...typography.body, color: colors.textSecondary, marginHorizontal: spacing.lg },
  statusText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', letterSpacing: 1 },
  venueText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  toggleBtnActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  toggleText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: colors.primary },
  statsCard: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  muted: { ...typography.body, color: colors.textSecondary },
  playerRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  playerInfo: { flex: 1 },
  playerName: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  playerMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  statsRow: { flex: 1, justifyContent: 'center' },
  statCell: { ...typography.caption, color: colors.textSecondary, fontSize: 10 },
  fpText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '800',
    minWidth: 50,
    textAlign: 'right',
  },
  errorText: { ...typography.body, color: colors.danger },
});
