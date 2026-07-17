import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { colors, radii, spacing, typography } from '@/theme/theme';

interface InjuredPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  injuryStatus: string;
  injuryBodyPart: string | null;
  active: boolean;
}

interface TeamInjuryGroup {
  team: string;
  players: InjuredPlayer[];
}

interface TopPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  fantasyPoints: number;
  passingYards: number;
  rushingYards: number;
  receivingYards: number;
}

interface WeeklyStatus {
  season: string;
  week: number;
  seasonType: string;
  weekStarted: boolean;
  weekCompleted: boolean;
}

interface InjuryResponse {
  teams: TeamInjuryGroup[];
  total: number;
}

interface TrendingResponse {
  season: string;
  week: number;
  topPlayers: TopPlayer[];
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

function injuryColor(status: string): string {
  switch (status) {
    case 'Out': return colors.danger;
    case 'IR': return '#B00020';
    case 'Doubtful': return '#E65100';
    case 'Questionable': return '#F9A825';
    default: return colors.textSecondary;
  }
}

const POSITION_COLORS: Record<string, string> = {
  QB: '#4CAF50', RB: '#2196F3', WR: '#FF9800', TE: '#9C27B0', K: '#607D8B', DEF: '#795548',
};

export default function GamedayScreen(): React.JSX.Element {
  const [injuries, setInjuries] = useState<InjuryResponse | null>(null);
  const [trending, setTrending] = useState<TrendingResponse | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showAllInjuries, setShowAllInjuries] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [injRes, trendRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/gameday/injuries`),
        fetch(`${API_URL}/gameday/trending`),
        fetch(`${API_URL}/nfl/state`),
      ]);

      if (injRes.ok) setInjuries(await injRes.json() as InjuryResponse);
      if (trendRes.ok) setTrending(await trendRes.json() as TrendingResponse);
      if (statusRes.ok) setWeekly(await statusRes.json() as WeeklyStatus);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const displayTeams = selectedTeam
    ? injuries?.teams.filter((t) => t.team === selectedTeam) ?? []
    : showAllInjuries
      ? (injuries?.teams ?? [])
      : (injuries?.teams ?? []).slice(0, 5);

  const teamList = [...new Set((injuries?.teams ?? []).map((t) => t.team))].sort();

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading Game Day data…</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={fetchAll} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Game Day</Text>
          {weekly ? (
            <Text style={styles.subtitle}>
              {weekly.season} · {weekly.weekStarted ? `Week ${weekly.week} LIVE` : `Week ${weekly.week}`}
            </Text>
          ) : null}
        </View>

        {/* Quick Stats Bar */}
        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{injuries?.total ?? 0}</Text>
            <Text style={styles.quickStatLabel}>Injured</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{trending?.topPlayers.length ?? 0}</Text>
            <Text style={styles.quickStatLabel}>Top Players</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{injuries?.teams.length ?? 0}</Text>
            <Text style={styles.quickStatLabel}>Teams</Text>
          </View>
        </View>

        {/* Injury Report */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Injury Report</Text>
          <Text style={styles.sectionBadge}>{injuries?.total ?? 0} players</Text>
        </View>

        {teamList.length > 0 ? (
          <Card style={styles.filterCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Pressable
                onPress={() => setSelectedTeam(null)}
                style={[styles.filterChip, !selectedTeam && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, !selectedTeam && styles.filterTextActive]}>All</Text>
              </Pressable>
              {teamList.map((team) => (
                <Pressable
                  key={team}
                  onPress={() => setSelectedTeam(team === selectedTeam ? null : team)}
                  style={[styles.filterChip, selectedTeam === team && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, selectedTeam === team && styles.filterTextActive]}>{team}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        ) : null}

        {displayTeams.length === 0 ? (
          <Card>
            <Text style={styles.muted}>
              {selectedTeam ? `No injuries for ${selectedTeam}.` : 'No injured players reported.'}
            </Text>
          </Card>
        ) : (
          displayTeams.map((team) => (
            <Card key={team.team} style={styles.teamCard}>
              <Text style={styles.teamTitle}>{team.team} · {team.players.length}</Text>
              {team.players.map((p) => (
                <View key={p.id} style={styles.injuryRow}>
                  <View style={styles.injuryInfo}>
                    <View style={[styles.posBadge, { backgroundColor: POSITION_COLORS[p.position] ?? colors.surfaceAlt }]}>
                      <Text style={styles.posText}>{p.position}</Text>
                    </View>
                    <View style={styles.injuryDetails}>
                      <Text style={styles.playerName}>{p.name}</Text>
                      {p.injuryBodyPart ? (
                        <Text style={styles.injuryMeta}>{p.injuryBodyPart}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: injuryColor(p.injuryStatus) + '22' }]}>
                    <Text style={[styles.statusText, { color: injuryColor(p.injuryStatus) }]}>
                      {p.injuryStatus}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          ))
        )}

        {!selectedTeam && (injuries?.teams.length ?? 0) > 5 ? (
          <Pressable onPress={() => setShowAllInjuries(!showAllInjuries)} style={styles.showAllBtn}>
            <Text style={styles.showAllText}>
              {showAllInjuries ? 'Show less' : `Show all ${injuries?.teams.length} teams`}
            </Text>
          </Pressable>
        ) : null}

        {/* Top Performers */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>This Week's Top Performers</Text>
          {trending ? <Text style={styles.sectionBadge}>Week {trending.week}</Text> : null}
        </View>

        {trending?.topPlayers && trending.topPlayers.length > 0 ? (
          <Card>
            {trending.topPlayers.slice(0, 10).map((p, i) => (
              <View key={p.playerId} style={[styles.trendingRow, i === 0 && styles.trendingRowFirst]}>
                <View style={styles.rankBlock}>
                  <Text style={[styles.rankText, i === 0 && styles.rankOne]}>{i + 1}</Text>
                </View>
                <View style={styles.trendingInfo}>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <View style={styles.trendingMetaRow}>
                    <View style={[styles.posBadge, { backgroundColor: POSITION_COLORS[p.position] ?? colors.surfaceAlt }]}>
                      <Text style={styles.posText}>{p.position}</Text>
                    </View>
                    <Text style={styles.injuryMeta}>{p.team}</Text>
                  </View>
                </View>
                <View style={styles.fpBlock}>
                  <Text style={styles.fpValue}>{p.fantasyPoints.toFixed(1)}</Text>
                  <Text style={styles.fpLabel}>FP</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <Text style={styles.muted}>No game data yet this week.</Text>
          </Card>
        )}

        {trending && trending.topPlayers.length > 10 ? (
          <Pressable style={styles.showAllBtn}>
            <Text style={styles.showAllText}>See full leaderboard</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  content: { paddingBottom: spacing.xl },
  header: { marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  quickStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickStat: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md,
  },
  quickStatValue: { ...typography.h2, color: colors.accent, marginBottom: 2 },
  quickStatLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  sectionBadge: { ...typography.caption, color: colors.textSecondary },
  filterCard: { marginBottom: spacing.sm, paddingVertical: spacing.sm },
  filterRow: { gap: spacing.xs },
  filterChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  filterText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: colors.primary },
  teamCard: { marginBottom: spacing.sm },
  teamTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, fontSize: 14 },
  injuryRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  injuryInfo: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  posBadge: {
    borderRadius: radii.pill,
    marginRight: spacing.sm,
    minWidth: 30,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  posText: { color: '#fff', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  injuryDetails: { flex: 1 },
  playerName: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  injuryMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  statusBadge: {
    borderRadius: radii.pill,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusText: { fontSize: 10, fontWeight: '800' },
  showAllBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  showAllText: { ...typography.body, color: colors.accent, fontWeight: '700' },
  trendingRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  trendingRowFirst: { borderTopWidth: 0 },
  rankBlock: {
    alignItems: 'center',
    marginRight: spacing.sm,
    width: 28,
  },
  rankText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  rankOne: { color: '#FFD700', fontSize: 18 },
  trendingInfo: { flex: 1 },
  trendingMetaRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: 1 },
  fpBlock: { alignItems: 'center', marginLeft: spacing.sm },
  fpValue: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  fpLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: '700' },
  errorBox: {
    backgroundColor: '#351A22',
    borderColor: colors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: { ...typography.caption, color: '#FFB4B8' },
  retryBtn: { marginTop: spacing.md, paddingVertical: spacing.sm },
  retryText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  muted: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
