import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { colors, radii, spacing, typography } from '@/theme/theme';

export default function HomeScreen(): React.JSX.Element {
  const { state, logout } = useAuth();
  const router = useRouter();
  const [draftId, setDraftId] = useState('');
  const email = state.status === 'authenticated' ? state.user.email : '';

  const openDraft = () => {
    const normalizedDraftId = draftId.trim();
    if (normalizedDraftId) router.push(`/draft/${encodeURIComponent(normalizedDraftId)}`);
  };

  return (
    <Screen>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>SIGNED IN AS</Text>
          <Text style={styles.email} numberOfLines={1}>{email}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Your Drafts</Text>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>No drafts yet</Text>
        <Text style={styles.cardBody}>
          Link a Yahoo or Sleeper league, or start a native draft, to get going. If you already
          have a native draft ID, enter it below.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/leagues')}
          style={styles.manageLeagues}
        >
          <Text style={styles.manageLeaguesText}>Manage league links</Text>
        </Pressable>
        <TextInput
          autoCapitalize="none"
          onChangeText={setDraftId}
          onSubmitEditing={openDraft}
          placeholder="Draft ID"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={draftId}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!draftId.trim()}
          onPress={openDraft}
          style={[styles.openDraft, !draftId.trim() && styles.openDraftDisabled]}
        >
          <Text style={styles.openDraftText}>Open live draft</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  eyebrow: { ...typography.caption, color: colors.textSecondary, fontSize: 10, letterSpacing: 1 },
  email: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.xs, maxWidth: 210 },
  logout: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  logoutText: { ...typography.caption, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  cardTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  cardBody: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  manageLeagues: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    paddingVertical: 12,
  },
  manageLeaguesText: { ...typography.body, color: colors.primary, fontWeight: '700' },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  openDraft: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    paddingVertical: 12,
  },
  openDraftDisabled: { opacity: 0.4 },
  openDraftText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
});
