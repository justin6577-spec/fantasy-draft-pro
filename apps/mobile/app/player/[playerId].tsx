import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { colors, radii, spacing, typography } from '@/theme/theme';
import { apiUrl } from '@/config/api';
import { useAuth } from '@/auth/AuthProvider';

interface PlayerNewsSummary {
  summaryText: string;
  impactTag: string;
  generatedAt: string;
}

const IMPACT_COLORS: Record<string, string> = {
  out: colors.danger,
  questionable: '#F59E0B',
  role_change: '#6366F1',
  breakout: '#10B981',
  neutral: colors.textSecondary,
};

export default function PlayerProfileScreen(): React.JSX.Element {
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const { getValidAccessToken } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<PlayerNewsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [onWatchlist, setOnWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);

  useCallback(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getValidAccessToken();
        const [newsRes, watchRes] = await Promise.all([
          fetch(apiUrl(`/players/${playerId}/news`)),
          fetch(apiUrl('/watchlist'), { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!cancelled && newsRes.ok) {
          const data = await newsRes.json();
          if (data.status === 'ok') setSummary(data.summary);
        }
        if (!cancelled && watchRes.ok) {
          const data = await watchRes.json();
          setOnWatchlist(data.watchlist?.some((w: any) => w.playerId === playerId) ?? false);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [playerId, getValidAccessToken])();

  const toggleWatchlist = async () => {
    setWatchlistBusy(true);
    try {
      const token = await getValidAccessToken();
      if (onWatchlist) {
        await fetch(apiUrl(`/watchlist/${playerId}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        setOnWatchlist(false);
      } else {
        await fetch(apiUrl('/watchlist'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ playerId }),
        });
        setOnWatchlist(true);
      }
    } catch { /* ignore */ }
    finally { setWatchlistBusy(false); }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Player Profile</Text>
        <Pressable
          accessibilityRole="button"
          disabled={watchlistBusy}
          onPress={() => void toggleWatchlist()}
          style={[styles.watchlistBtn, onWatchlist && styles.watchlistBtnActive]}
        >
          {watchlistBusy ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text style={styles.watchlistText}>
              {onWatchlist ? 'Watching' : '+ Watch'}
            </Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <Card>
          <Text style={styles.cardTitle}>Player ID</Text>
          <Text style={styles.playerId}>{playerId}</Text>

          <View style={styles.newsSection}>
            <Text style={styles.sectionTitle}>Recent News</Text>
            {summary ? (
              <>
                <View style={[styles.tagBadge, { backgroundColor: IMPACT_COLORS[summary.impactTag] ?? colors.textSecondary }]}>
                  <Text style={styles.tagText}>{summary.impactTag.replace('_', ' ')}</Text>
                </View>
                <Text style={styles.summaryText}>{summary.summaryText}</Text>
                <Text style={styles.timestamp}>
                  Updated {new Date(summary.generatedAt).toLocaleDateString()}
                </Text>
              </>
            ) : (
              <Text style={styles.noNews}>No recent news.</Text>
            )}
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  watchlistBtn: {
    borderColor: colors.primary,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  watchlistBtnActive: {
    backgroundColor: colors.primary,
  },
  watchlistText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  cardTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  playerId: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.md },
  newsSection: { marginTop: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  tagBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  tagText: { ...typography.caption, color: '#fff', fontWeight: '700', textTransform: 'uppercase', fontSize: 10 },
  summaryText: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  timestamp: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, fontSize: 10 },
  noNews: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },
});
