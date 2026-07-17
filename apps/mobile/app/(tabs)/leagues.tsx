import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  disconnectLeagueLink,
  linkSleeperLeague,
  linkYahooLeague,
  listLeagueLinks,
  type LeagueLink,
  type LeagueLinkPlatform,
} from '@/api/league-links';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { colors, radii, spacing, typography } from '@/theme/theme';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function LeaguesScreen(): React.JSX.Element {
  const [links, setLinks] = useState<LeagueLink[]>([]);
  const [platform, setPlatform] = useState<LeagueLinkPlatform>('sleeper');
  const [externalLeagueId, setExternalLeagueId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [tokenSecret, setTokenSecret] = useState('');
  const [sessionHandle, setSessionHandle] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await listLeagueLinks();
      setLinks(result.links);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canSubmit =
    externalLeagueId.trim().length > 0 &&
    (platform === 'sleeper' || (accessToken.length > 0 && tokenSecret.length > 0));

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (platform === 'sleeper') {
        await linkSleeperLeague(externalLeagueId.trim());
      } else {
        await linkYahooLeague({
          externalLeagueId: externalLeagueId.trim(),
          accessToken,
          tokenSecret,
          sessionHandle: sessionHandle.trim() || undefined,
        });
      }
      setExternalLeagueId('');
      setAccessToken('');
      setTokenSecret('');
      setSessionHandle('');
      setNotice('League link saved. Saving a link does not start external synchronization.');
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDisconnect = (link: LeagueLink) => {
    Alert.alert(
      `Disconnect ${link.platform === 'yahoo' ? 'Yahoo' : 'Sleeper'} league?`,
      'This stops this managed link and removes its stored credentials. Shared league and draft data is retained.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setError(null);
              try {
                await disconnectLeagueLink(link.id);
                setNotice('League disconnected and link-specific credentials removed.');
                await refresh();
              } catch (caught) {
                setError(errorMessage(caught));
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>League Links</Text>
        <Text style={styles.intro}>
          Manage league references used by Fantasy Draft Pro. This screen stores links only; it
          does not claim or initiate external league synchronization.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Text style={styles.sectionTitle}>Connected leagues</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : links.length === 0 ? (
          <Card style={styles.card}>
            <Text style={styles.muted}>No managed league links yet.</Text>
          </Card>
        ) : (
          links.map((link) => (
            <Card key={link.id} style={styles.card}>
              <View style={styles.linkHeading}>
                <Text style={styles.cardTitle}>
                  {link.platform === 'yahoo' ? 'Yahoo' : 'Sleeper'}
                </Text>
                <Text
                  style={[
                    styles.status,
                    link.status === 'active' ? styles.activeStatus : styles.inactiveStatus,
                  ]}
                >
                  {link.status}
                </Text>
              </View>
              <Text selectable style={styles.leagueId}>{link.externalLeagueId}</Text>
              <Text style={styles.muted}>
                {link.hasCredentials ? 'Encrypted credentials stored' : 'No credentials stored'}
              </Text>
              {link.status !== 'disconnected' ? (
                <Pressable style={styles.disconnectButton} onPress={() => confirmDisconnect(link)}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </Pressable>
              ) : null}
            </Card>
          ))
        )}

        <Text style={styles.sectionTitle}>Link a league</Text>
        <View style={styles.platformRow}>
          {(['sleeper', 'yahoo'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setPlatform(value);
                setError(null);
                setNotice(null);
              }}
              style={[styles.platformButton, platform === value && styles.platformButtonSelected]}
            >
              <Text style={styles.platformButtonText}>
                {value === 'sleeper' ? 'Sleeper' : 'Yahoo'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Card style={styles.card}>
          <Text style={styles.label}>
            {platform === 'sleeper' ? 'Sleeper league ID' : 'Yahoo league key'}
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setExternalLeagueId}
            placeholder={platform === 'sleeper' ? '1234567890' : 'nfl.l.12345'}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={externalLeagueId}
          />

          {platform === 'yahoo' ? (
            <>
              <Text style={styles.warning}>
                Yahoo requires OAuth token material obtained through an authorized flow. Platform
                passwords are never accepted. Tokens are encrypted by the server before storage.
              </Text>
              <Text style={styles.label}>OAuth access token</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setAccessToken}
                secureTextEntry
                style={styles.input}
                value={accessToken}
              />
              <Text style={styles.label}>OAuth token secret</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setTokenSecret}
                secureTextEntry
                style={styles.input}
                value={tokenSecret}
              />
              <Text style={styles.label}>OAuth session handle (optional)</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setSessionHandle}
                secureTextEntry
                style={styles.input}
                value={sessionHandle}
              />
            </>
          ) : null}

          <Pressable
            disabled={!canSubmit || submitting}
            onPress={() => void submit()}
            style={[styles.submitButton, (!canSubmit || submitting) && styles.disabled]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.submitText}>Save managed link</Text>
            )}
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.md },
  card: { marginBottom: spacing.sm },
  cardTitle: { ...typography.h3, color: colors.textPrimary },
  linkHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  leagueId: { ...typography.body, color: colors.textPrimary, marginVertical: spacing.sm },
  muted: { ...typography.caption, color: colors.textSecondary },
  status: { ...typography.caption, fontWeight: '700', textTransform: 'uppercase' },
  activeStatus: { color: colors.success },
  inactiveStatus: { color: colors.textSecondary },
  error: { ...typography.body, color: colors.danger, marginBottom: spacing.sm },
  notice: { ...typography.body, color: colors.success, marginBottom: spacing.sm },
  platformRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  platformButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  platformButtonSelected: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  platformButtonText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
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
  warning: { ...typography.caption, color: colors.accent, marginTop: spacing.md },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    marginTop: spacing.md,
    minHeight: 46,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  submitText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  disconnectButton: { alignSelf: 'flex-start', marginTop: spacing.md, paddingVertical: spacing.xs },
  disconnectText: { ...typography.body, color: colors.danger, fontWeight: '600' },
});
