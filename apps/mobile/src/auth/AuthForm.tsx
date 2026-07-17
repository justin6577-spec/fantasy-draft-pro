import { useState } from 'react';
import { Link } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthTransportError } from './errors';
import { colors, radii, spacing, typography } from '@/theme/theme';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onSubmit(email: string, password: string): Promise<void>;
  onGoogleSignIn?(): Promise<void>;
  onAppleSignIn?(): Promise<void>;
}

export function AuthForm({ mode, onSubmit, onGoogleSignIn, onAppleSignIn }: AuthFormProps): React.JSX.Element {
  const isSignup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (isSignup && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSubmit(normalizedEmail, password);
    } catch (caught) {
      setError(
        caught instanceof AuthTransportError ? caught.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.brandBlock}>
        <Text style={styles.eyebrow}>FANTASY DRAFT PRO</Text>
        <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={styles.subtitle}>
          {isSignup
            ? 'Build smarter drafts with live sync and AI recommendations.'
            : 'Sign in to return to your leagues and live drafts.'}
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={email}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          editable={!busy}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submit,
            pressed && styles.submitPressed,
            busy && styles.submitDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.submitText}>{isSignup ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        {(onGoogleSignIn || onAppleSignIn) ? (
          <View style={styles.socialSection}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.socialRow}>
              {onAppleSignIn ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onAppleSignIn()}
                  style={({ pressed }) => [styles.socialButton, pressed && styles.submitPressed]}
                >
                  <Text style={styles.socialButtonText}>Apple</Text>
                </Pressable>
              ) : null}
              {onGoogleSignIn ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onGoogleSignIn()}
                  style={({ pressed }) => [styles.socialButton, pressed && styles.submitPressed]}
                >
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text style={styles.switchText}>
          {isSignup ? 'Already have an account? ' : 'New to Fantasy Draft Pro? '}
          <Link href={isSignup ? '/login' : '/signup'} style={styles.link}>
            {isSignup ? 'Sign in' : 'Create one'}
          </Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  brandBlock: { marginBottom: spacing.xl },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  submit: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  submitPressed: { opacity: 0.85 },
  submitDisabled: { opacity: 0.6 },
  submitText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  switchText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  link: { color: colors.primary, fontWeight: '600' },
  socialSection: { marginTop: spacing.lg },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginHorizontal: spacing.sm,
  },
  socialRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  socialButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  socialButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
