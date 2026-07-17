import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { draftIdFromNotificationData } from '@/notifications/notification-data';
import { colors, radii, spacing, typography } from '@/theme/theme';

function SessionBoundary(): React.JSX.Element {
  const { state, retrySession, logout } = useAuth();
  const router = useRouter();
  const authenticated = state.status === 'authenticated';

  useEffect(() => {
    if (!authenticated) return;

    const openDraft = (response: Notifications.NotificationResponse) => {
      const draftId = draftIdFromNotificationData(response.notification.request.content.data);
      if (draftId) router.push(`/draft/${encodeURIComponent(draftId)}`);
    };

    const pendingResponse = Notifications.getLastNotificationResponse();
    if (pendingResponse) {
      openDraft(pendingResponse);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(openDraft);
    return () => subscription.remove();
  }, [authenticated, router]);

  if (state.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.statusText}>Restoring your session…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Couldn’t restore your session</Text>
        <Text style={styles.errorBody}>{state.error}</Text>
        <Pressable style={styles.primaryButton} onPress={() => void retrySession()}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!authenticated}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={authenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="draft/[draftId]" options={{ title: 'Live Draft' }} />
          <Stack.Screen name="game/[gameId]" options={{ title: 'Game' }} />
          <Stack.Screen name="player/[playerId]" options={{ title: 'Player' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout(): React.JSX.Element {
  return (
    <AuthProvider>
      <SessionBoundary />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  statusText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  errorTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minWidth: 180,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  primaryButtonText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  secondaryButton: { marginTop: spacing.md, padding: spacing.sm },
  secondaryButtonText: { ...typography.body, color: colors.textSecondary },
});
