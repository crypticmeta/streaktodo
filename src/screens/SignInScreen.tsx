import { Pressable, StyleSheet, Text, View } from 'react-native';
import { branding } from '../../branding';
import { useAuth } from '../lib/auth';
import { useTheme } from '../theme';

export function SignInScreen() {
  const t = useTheme();
  const { state, signIn, continueAsGuest } = useAuth();

  const isLoading = state.status === 'loading';
  const isUnsupported = state.status === 'unsupported';
  const error = state.status === 'signed-out' ? state.error : null;

  return (
    <View style={[styles.container, { backgroundColor: t.color.background }]}>
      <View style={styles.shell}>
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: t.color.surface,
              borderColor: t.color.border,
              borderRadius: t.radius['3xl'],
              padding: t.spacing['2xl'],
              ...t.elevation.lg,
            },
          ]}
        >
          <Text
            style={{
              fontSize: t.fontSize.xs,
              textTransform: 'uppercase',
              letterSpacing: t.tracking.wider,
              color: t.color.textMuted,
              fontWeight: t.fontWeight.bold,
              marginBottom: 10,
            }}
          >
            Welcome
          </Text>
          <Text
            style={{
              fontSize: t.fontSize['4xl'],
              fontWeight: t.fontWeight.bold,
              color: t.color.textPrimary,
              letterSpacing: t.tracking.tight,
            }}
          >
            {branding.appName}
          </Text>
          <Text
            style={{
              fontSize: t.fontSize.base,
              lineHeight: t.fontSize.base * t.lineHeight.normal,
              color: t.color.textSecondary,
              marginTop: t.spacing.sm,
            }}
          >
            Plan tasks, schedule reminders, and keep a streak. Sign in to
            label your data with your Google account, or continue without
            an account — the app is fully usable either way.
          </Text>

          {isUnsupported ? (
            <View
              style={[
                styles.messageBox,
                {
                  backgroundColor: t.color.warnSoft,
                  borderColor: t.color.borderMuted,
                  borderRadius: t.radius.xl,
                  padding: t.spacing.lg,
                  marginTop: t.spacing.lg,
                },
              ]}
            >
              <Text style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold, color: t.color.textPrimary }}>
                Unsupported runtime
              </Text>
              <Text
                style={{
                  fontSize: t.fontSize.sm,
                  lineHeight: t.fontSize.sm * t.lineHeight.normal,
                  color: t.color.textSecondary,
                  marginTop: 8,
                }}
              >
                {state.reason}
              </Text>
            </View>
          ) : null}

          {error ? (
            <View
              style={[
                styles.messageBox,
                {
                  backgroundColor: t.color.surfaceMuted,
                  borderColor: t.color.borderMuted,
                  borderRadius: t.radius.xl,
                  padding: t.spacing.lg,
                  marginTop: t.spacing.lg,
                },
              ]}
            >
              <Text style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold, color: t.color.danger }}>
                Sign-in error
              </Text>
              <Text
                style={{
                  fontSize: t.fontSize.sm,
                  lineHeight: t.fontSize.sm * t.lineHeight.normal,
                  color: t.color.textSecondary,
                  marginTop: 8,
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: t.color.accent,
              borderRadius: t.radius['2xl'],
              paddingHorizontal: t.spacing.lg,
              paddingVertical: t.spacing.lg,
              ...t.elevation.md,
              shadowColor: t.color.accent,
            },
            (isLoading || isUnsupported) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={signIn}
          disabled={isLoading || isUnsupported}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          accessibilityState={{ disabled: isLoading || isUnsupported, busy: isLoading }}
          accessibilityHint="Uses your Google account to sign in"
        >
          <Text style={{ color: t.color.textOnAccent, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.bold }}>
            Sign in with Google
          </Text>
          <Text style={{ color: t.color.textOnAccentSoft, fontSize: t.fontSize.sm, marginTop: 4 }}>
            {isLoading ? 'Restoring session…' : 'Uses your Google account'}
          </Text>
        </Pressable>

        {/* Guest mode: skip Google Sign-In and use the app locally. Available
            even on unsupported runtimes (Expo Go, missing client ID) so the
            app is at least demo-able. Disabled only while we're still
            restoring an existing session. */}
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderRadius: t.radius['2xl'],
              paddingHorizontal: t.spacing.lg,
              paddingVertical: t.spacing.md,
              borderColor: t.color.border,
            },
            isLoading && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => {
            void continueAsGuest();
          }}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Continue without signing in"
          accessibilityHint="Use the app without a Google account; data stays on this device"
        >
          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize.md,
              fontWeight: t.fontWeight.semibold,
              textAlign: 'center',
            }}
          >
            Continue without signing in
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  shell: {
    width: '100%',
    maxWidth: 420,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
  },
  messageBox: {
    borderWidth: 1,
  },
  button: {
    alignItems: 'flex-start',
  },
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
