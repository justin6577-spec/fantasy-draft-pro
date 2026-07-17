/**
 * Paywall screen — seasonal subscription purchase flow.
 * Uses react-native-purchases (RevenueCat) via the already-installed
 * `react-native-purchases` and `react-native-purchases-ui` packages.
 *
 * TODO: Initialize Purchases with the RevenueCat API key in app startup,
 * then this screen reads offerings and triggers the purchase sheet.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { colors, radii, spacing, typography } from '@/theme/theme';

const OFFERINGS_AVAILABLE = false; // set to true once Purchases is initialized with offerings

export default function PaywallScreen(): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  const purchase = async () => {
    setBusy(true);
    try {
      // TODO: await Purchases.purchaseProduct('season_2026');
      // On success, RevenueCat webhook will update the backend Entitlement.
      // The mobile app should then call /auth/me to refresh entitlement status.
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch { /* user cancelled or error */ }
    finally { setBusy(false); }
  };

  const restore = async () => {
    setBusy(true);
    try {
      // TODO: await Purchases.restorePurchases();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Text style={styles.title}>Go Premium</Text>

      <Card style={styles.featureCard}>
        <Text style={styles.emoji}>🤖</Text>
        <Text style={styles.featureTitle}>AI Draft Recommendations</Text>
        <Text style={styles.featureBody}>
          Get real-time AI-powered pick suggestions with natural-language explanations.
        </Text>
      </Card>

      <Card style={styles.featureCard}>
        <Text style={styles.emoji}>📰</Text>
        <Text style={styles.featureTitle}>Player News Summaries</Text>
        <Text style={styles.featureBody}>
          AI-summarized news with fantasy impact tags for every player.
        </Text>
      </Card>

      <Card style={styles.featureCard}>
        <Text style={styles.emoji}>🏈</Text>
        <Text style={styles.featureTitle}>Live Draft Sync</Text>
        <Text style={styles.featureBody}>
          Real-time sync with Sleeper and Yahoo leagues. Never miss a pick.
        </Text>
      </Card>

      <Card style={styles.pricingCard}>
        <Text style={styles.pricingTitle}>2026 Season Pass</Text>
        <Text style={styles.price}>$9.99</Text>
        <Text style={styles.pricingCaption}>One purchase. Full season. All features.</Text>

        {OFFERINGS_AVAILABLE ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void purchase()}
            style={[styles.buyButton, busy && styles.buyButtonDisabled]}
          >
            {busy ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.buyButtonText}>Subscribe</Text>
            )}
          </Pressable>
        ) : (
          <Text style={styles.comingSoon}>In-app purchase not yet configured{'\n'}(Add RevenueCat API key to initialize)</Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void restore()}
          style={styles.restoreButton}
        >
          <Text style={styles.restoreText}>Restore purchases</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg, textAlign: 'center' },
  featureCard: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
  },
  emoji: { fontSize: 28, marginRight: spacing.md },
  featureTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700', width: '100%', marginTop: spacing.xs },
  featureBody: { ...typography.caption, color: colors.textSecondary, marginTop: 2, width: '100%' },
  pricingCard: { alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.lg },
  pricingTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  price: { ...typography.h1, color: colors.primary, fontSize: 36, marginBottom: spacing.xs },
  pricingCaption: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  buyButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  buyButtonDisabled: { opacity: 0.5 },
  buyButtonText: { ...typography.body, color: colors.textPrimary, fontWeight: '700', fontSize: 18 },
  comingSoon: {
    ...typography.caption,
    color: colors.accent,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },
  restoreButton: { marginTop: spacing.md },
  restoreText: { ...typography.caption, color: colors.textSecondary, textDecorationLine: 'underline' },
});
