import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useDraftRoom } from '@/draft/useDraftRoom';
import { colors, radii, spacing, typography } from '@/theme/theme';

export default function DraftRoomScreen(): React.JSX.Element {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const [playerId, setPlayerId] = useState('');
  const [expandedRecommendationId, setExpandedRecommendationId] = useState<string | null>(null);
  const room = useDraftRoom(draftId);
  const draft = room.snapshot?.draft;
  const recommendations =
    room.recommendations?.pickIndex === draft?.currentPickIndex ? room.recommendations : null;
  const isComplete = draft?.status === 'completed';
  const canSubmit =
    room.isMyTurn &&
    room.connectionStatus === 'connected' &&
    !room.submitting &&
    !isComplete &&
    playerId.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    room.submitPick(playerId);
    setPlayerId('');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Draft Room</Text>
            <Text style={styles.draftId}>ID {draftId}</Text>
          </View>
          <View style={[styles.statusBadge, room.connectionStatus === 'connected' && styles.liveBadge]}>
            <View
              style={[
                styles.statusDot,
                room.connectionStatus === 'connected' && styles.liveDot,
              ]}
            />
            <Text style={styles.statusText}>{room.connectionStatus.toUpperCase()}</Text>
          </View>
        </View>

        {room.loading && !room.snapshot ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Loading authoritative draft state…</Text>
          </Card>
        ) : null}

        {room.error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{room.error}</Text>
          </View>
        ) : null}

        {draft ? (
          <>
            <Card style={[styles.card, room.isMyTurn && styles.onClockCard]}>
              <View style={styles.clockRow}>
                <View>
                  <Text style={styles.label}>{isComplete ? 'DRAFT STATUS' : 'ON THE CLOCK'}</Text>
                  <Text style={styles.teamText}>
                    {isComplete ? 'Draft complete' : room.onTheClockTeamId ?? 'Waiting…'}
                  </Text>
                  {room.teamId ? <Text style={styles.yourTeam}>Your team: {room.teamId}</Text> : null}
                </View>
                <View style={styles.clockBlock}>
                  <Text style={styles.clock}>{isComplete ? '—' : draft.clockSecondsRemaining}</Text>
                  <Text style={styles.seconds}>SECONDS</Text>
                </View>
              </View>
              {!isComplete ? (
                <Text style={[styles.turnNotice, room.isMyTurn && styles.yourTurnNotice]}>
                  {room.isMyTurn ? 'You’re up — submit your pick.' : 'Waiting for the current team.'}
                </Text>
              ) : null}
            </Card>

            {!isComplete ? (
              <Card style={styles.card}>
                <View style={styles.recommendationHeading}>
                  <Text style={styles.sectionTitle}>Recommended Picks</Text>
                  {recommendations?.degraded ? (
                    <Text style={styles.degradedBadge}>STATIC</Text>
                  ) : null}
                </View>
                {room.recommendationsLoading ? (
                  <View style={styles.recommendationStatus}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.muted}>Updating for the latest draft state…</Text>
                  </View>
                ) : room.recommendationsError ? (
                  <View>
                    <Text style={styles.recommendationError}>{room.recommendationsError}</Text>
                    <Pressable onPress={room.refreshRecommendations} style={styles.retryButton}>
                      <Text style={styles.retryText}>Try again</Text>
                    </Pressable>
                  </View>
                ) : recommendations && recommendations.candidates.length === 0 ? (
                  <Text style={styles.muted}>
                    No projection rankings are available for this league’s season and scoring format.
                  </Text>
                ) : recommendations ? (
                  <View style={styles.recommendationList}>
                    {recommendations.degraded ? (
                      <Text style={styles.degradedNotice}>
                        Live AI explanations are unavailable. Showing deterministic ranking analysis.
                      </Text>
                    ) : null}
                    {recommendations.candidates.map((candidate) => {
                      const expanded = expandedRecommendationId === candidate.playerId;
                      const why = recommendations.reasoning.find(
                        (reason) => reason.playerId === candidate.playerId,
                      )?.explanation;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={candidate.playerId}
                          onPress={() =>
                            setExpandedRecommendationId(expanded ? null : candidate.playerId)
                          }
                          style={styles.recommendationRow}
                        >
                          <View style={styles.recommendationRank}>
                            <Text style={styles.recommendationRankText}>{candidate.rank}</Text>
                          </View>
                          <View style={styles.recommendationDetails}>
                            <Text style={styles.recommendationName}>{candidate.playerName}</Text>
                            <Text style={styles.recommendationMeta}>
                              {candidate.position} · {candidate.team} · {candidate.projectedPoints.toFixed(1)} pts
                            </Text>
                            {expanded ? (
                              <Text style={styles.whyText}>{why ?? 'No explanation is available.'}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.whyToggle}>{expanded ? 'LESS' : 'WHY'}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.muted}>Recommendations will appear when draft state is ready.</Text>
                )}
              </Card>
            ) : null}

            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>Submit a player</Text>
              <Text style={styles.helper}>
                Player search is the next data feature. For now, enter an available player ID.
              </Text>
              <TextInput
                autoCapitalize="none"
                editable={!room.submitting && !isComplete}
                onChangeText={setPlayerId}
                onSubmitEditing={submit}
                placeholder="Player ID"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={playerId}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={submit}
                style={({ pressed }) => [
                  styles.submit,
                  !canSubmit && styles.submitDisabled,
                  pressed && canSubmit && styles.submitPressed,
                ]}
              >
                {room.submitting ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.submitText}>Make pick</Text>
                )}
              </Pressable>
            </Card>

            <View style={styles.boardHeading}>
              <Text style={styles.sectionTitle}>Draft board</Text>
              <Text style={styles.pickCount}>{room.snapshot?.picks.length ?? 0} picks</Text>
            </View>
            {(room.snapshot?.picks.length ?? 0) === 0 ? (
              <Card style={styles.card}>
                <Text style={styles.muted}>No picks have been made yet.</Text>
              </Card>
            ) : (
              room.snapshot?.picks.map((pick) => (
                <View key={pick.id} style={styles.pickRow}>
                  <View style={styles.pickNumber}>
                    <Text style={styles.pickNumberText}>{pick.pickIndex + 1}</Text>
                  </View>
                  <View style={styles.pickDetails}>
                    <Text style={styles.playerName}>{pick.playerId || 'Skipped pick'}</Text>
                    <Text style={styles.pickMeta}>{pick.teamId} · {pick.source}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  draftId: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  statusBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  liveBadge: { backgroundColor: '#18362B' },
  statusDot: {
    backgroundColor: colors.textSecondary,
    borderRadius: radii.pill,
    height: 7,
    marginRight: spacing.xs,
    width: 7,
  },
  liveDot: { backgroundColor: colors.success },
  statusText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  loadingCard: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  errorBanner: {
    backgroundColor: '#351A22',
    borderColor: colors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  errorText: { ...typography.caption, color: '#FFB4B8' },
  card: { marginBottom: spacing.md },
  onClockCard: { borderColor: colors.accent },
  clockRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  teamText: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xs },
  yourTeam: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  clockBlock: { alignItems: 'center', minWidth: 72 },
  clock: { color: colors.accent, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  seconds: { color: colors.textSecondary, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  turnNotice: {
    ...typography.caption,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    color: colors.textSecondary,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  yourTurnNotice: { color: colors.accent, fontWeight: '700' },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  recommendationHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  degradedBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.pill,
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recommendationStatus: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  recommendationError: { ...typography.caption, color: '#FFB4B8' },
  retryButton: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: spacing.xs },
  retryText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  degradedNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  recommendationList: { gap: spacing.xs },
  recommendationRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  recommendationRank: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.pill,
    height: 28,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 28,
  },
  recommendationRankText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  recommendationDetails: { flex: 1 },
  recommendationName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  recommendationMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  whyToggle: { color: colors.accent, fontSize: 10, fontWeight: '800', marginLeft: spacing.sm },
  whyText: { ...typography.caption, color: colors.textPrimary, lineHeight: 18, marginTop: spacing.xs },
  helper: { ...typography.caption, color: colors.textSecondary, lineHeight: 19, marginTop: spacing.xs },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  submit: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 46,
  },
  submitDisabled: { opacity: 0.4 },
  submitPressed: { opacity: 0.85 },
  submitText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  boardHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  pickCount: { ...typography.caption, color: colors.textSecondary },
  muted: { ...typography.body, color: colors.textSecondary },
  pickRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  pickNumber: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.md,
    height: 36,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 36,
  },
  pickNumberText: { color: colors.textPrimary, fontWeight: '800' },
  pickDetails: { flex: 1 },
  playerName: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  pickMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
