import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { colors, radii, spacing, typography } from '@/theme/theme';

type NFLPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

interface PlayerRow {
  id: string;
  name: string;
  position: string;
  team: string;
  byeWeek: number | null;
  rank: number | null;
  projectedPoints: number | null;
  adp: number | null;
}

const POSITIONS: NFLPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export default function PlayersScreen(): React.JSX.Element {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<NFLPosition | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlayers = useCallback(async (pageNum: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({ limit: '50', page: String(pageNum) });
      if (positionFilter) params.set('position', positionFilter);
      if (search.trim()) params.set('search', search.trim());

      const response = await fetch(`${API_URL}/players?${params}`);
      if (!response.ok) throw new Error('Unable to load players.');

      const data = await response.json();
      if (append) {
        setPlayers((prev) => [...prev, ...data.players]);
      } else {
        setPlayers(data.players);
      }
      setTotal(data.pagination.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [positionFilter, search]);

  useEffect(() => {
    setPage(1);
    fetchPlayers(1, false);
  }, [fetchPlayers]);

  const loadMore = useCallback(() => {
    if (loadingMore || players.length >= total) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPlayers(nextPage, true);
  }, [loadingMore, players.length, total, page, fetchPlayers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchPlayers(1, false);
  }, [fetchPlayers]);

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return players;
    const q = search.toLowerCase();
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q),
    );
  }, [players, search]);

  const positionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of players) {
      counts[p.position] = (counts[p.position] || 0) + 1;
    }
    return counts;
  }, [players]);

  const renderRow = ({ item, index }: { item: PlayerRow; index: number }) => {
    const displayRank = item.rank ?? '-';
    const displayPts = item.projectedPoints?.toFixed(1) ?? '-';
    const adpDiff =
      item.adp != null && item.rank != null ? (item.adp - item.rank).toFixed(1) : null;

    return (
      <View style={[styles.row, index === 0 && styles.rowFirst]}>
        <View style={styles.rankCell}>
          <Text style={styles.rankText}>{displayRank}</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.positionBadge}>
              <Text style={styles.positionText}>{item.position}</Text>
            </View>
            <Text style={styles.teamText}>{item.team}</Text>
            {item.byeWeek ? <Text style={styles.byeText}>BYE {item.byeWeek}</Text> : null}
          </View>
        </View>
        <View style={styles.pointsCell}>
          <Text style={styles.pointsText}>{displayPts}</Text>
          {adpDiff ? (
            <Text style={[styles.adpText, Number(adpDiff) > 0 ? styles.adpPositive : styles.adpNegative]}>
              {Number(adpDiff) > 0 ? '+' : ''}{adpDiff}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Player Rankings</Text>
        <Text style={styles.count}>{total} players</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearch}
          placeholder="Search name or team..."
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          value={search}
        />
      </View>

      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setPositionFilter(null)}
          style={[styles.filterChip, positionFilter === null && styles.filterChipActive]}
        >
          <Text style={[styles.filterText, positionFilter === null && styles.filterTextActive]}>
            All {total > 0 ? `(${total})` : ''}
          </Text>
        </Pressable>
        {POSITIONS.map((pos) => (
          <Pressable
            key={pos}
            onPress={() => setPositionFilter(pos === positionFilter ? null : pos)}
            style={[styles.filterChip, positionFilter === pos && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, positionFilter === pos && styles.filterTextActive]}>
              {pos} {positionCounts[pos] ? `(${positionCounts[pos]})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => fetchPlayers(1, false)} style={styles.retryButton}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </Pressable>
        </Card>
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={loadMore}
          onEndReachedThreshold={2}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? 'No players match your search. Try a different name.'
                  : 'No player data available yet.'}
              </Text>
            </Card>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  count: { ...typography.caption, color: colors.textSecondary },
  searchRow: { marginBottom: spacing.sm },
  searchInput: {
    ...typography.body,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  filterText: { ...typography.caption, color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: colors.primary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorCard: { alignItems: 'center', padding: spacing.lg },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center' },
  retryButton: { marginTop: spacing.md, paddingVertical: spacing.sm },
  retryText: { ...typography.body, color: colors.accent, fontWeight: '700' },
  list: { paddingBottom: spacing.xl },
  row: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  rowFirst: { borderTopWidth: 0 },
  rankCell: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.pill,
    height: 28,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 28,
  },
  rankText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  infoCell: { flex: 1 },
  nameText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: 2 },
  positionBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  positionText: { ...typography.caption, color: colors.textSecondary, fontSize: 10, fontWeight: '800' },
  teamText: { ...typography.caption, color: colors.textSecondary },
  byeText: { ...typography.caption, color: colors.textSecondary, fontSize: 10 },
  pointsCell: { alignItems: 'flex-end', marginLeft: spacing.sm, minWidth: 56 },
  pointsText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  adpText: { ...typography.caption, fontSize: 10, fontWeight: '600' },
  adpPositive: { color: colors.success },
  adpNegative: { color: colors.danger },
  emptyCard: { padding: spacing.lg },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
