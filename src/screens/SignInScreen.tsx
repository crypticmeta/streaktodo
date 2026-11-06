import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { branding } from '../../branding';
import { Icon } from '../components/Icon';
import { useAuth } from '../lib/auth';
import { useTheme } from '../theme';

export function SignInScreen() {
  const t = useTheme();
  const { state, busy, signIn, continueAsGuest } = useAuth();
  const loading = state.status === 'loading' || busy;
  const unsupported = state.status === 'unsupported';
  const error = state.status === 'signed-out' ? state.error : null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.color.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: t.spacing['2xl'], paddingVertical: t.spacing['3xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.intro,
            {
              backgroundColor: t.color.infoSoft,
              borderRadius: t.radius['3xl'],
              padding: t.spacing['2xl'],
              ...t.elevation.sm,
            },
          ]}
        >
          <View style={[styles.decorDot, styles.decorDotOne, { backgroundColor: t.color.warnSoft }]} />
          <View style={[styles.decorDot, styles.decorDotTwo, { backgroundColor: t.color.accentSoft }]} />
          <View style={[styles.mark, { backgroundColor: t.color.accent, borderRadius: t.radius.xl }]}>
            <Icon name="sparkles" size={27} color={t.color.textOnAccent} />
          </View>
          <Text style={{ color: t.color.info, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.bold, letterSpacing: t.tracking.wider }}>
            {branding.appName.toUpperCase()}
          </Text>
          <Text style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize['4xl'],
            fontWeight: t.fontWeight.heavy,
            letterSpacing: t.tracking.tight,
          }}>
            Make progress stick.
          </Text>
          <Text style={{
            color: t.color.textSecondary,
            fontSize: t.fontSize.md,
            lineHeight: 23,
            maxWidth: 420,
          }}>
            Turn everyday tasks into tiny wins worth coming back for.
          </Text>
        </View>

        <View style={[styles.facts, { backgroundColor: t.color.surface, borderColor: t.color.border, borderRadius: t.radius['2xl'], ...t.elevation.sm }]}>
          <Fact tone="accent" text="Sign in with Google, or use the app locally without an account." />
          <Fact tone="warning" text="Tasks stay on this device. Export or restore a JSON backup from Insights." />
          <Fact tone="info" text="Mixpanel receives product actions, never task titles, notes, or backup contents." />
        </View>

        {unsupported ? (
          <Notice title="Google sign-in unavailable" message={state.reason} tone="warning" />
        ) : null}
        {error ? <Notice title="Couldn’t sign in" message={error} tone="error" /> : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => { void signIn(); }}
            disabled={loading || unsupported}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            accessibilityState={{ disabled: loading || unsupported, busy: loading }}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: t.color.accent,
                borderRadius: t.radius.xl,
                opacity: loading || unsupported ? 0.45 : pressed ? 0.86 : 1,
                ...t.elevation.md,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={t.color.textOnAccent} />
            ) : (
              <>
                <View style={[styles.googleMark, { backgroundColor: t.color.background, borderRadius: t.radius.pill }]}>
                  <Text style={{ color: t.color.accent, fontWeight: t.fontWeight.heavy }}>G</Text>
                </View>
                <Text style={{ color: t.color.textOnAccent, fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold }}>
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => { void continueAsGuest(); }}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continue locally without signing in"
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: t.color.borderStrong,
                borderRadius: t.radius.xl,
                backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                opacity: loading ? 0.45 : 1,
              },
            ]}
          >
            <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
              Continue locally
            </Text>
          </Pressable>
        </View>

        <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, lineHeight: 17, textAlign: 'center' }}>
          Product analytics is on by default and can be turned off any time in Insights.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({ text, tone }: { text: string; tone: 'accent' | 'warning' | 'info' }) {
  const t = useTheme();
  const backgroundColor = tone === 'accent'
    ? t.color.accentMuted
    : tone === 'warning'
      ? t.color.warnSoft
      : t.color.infoSoft;
  const color = tone === 'accent'
    ? t.color.accent
    : tone === 'warning'
      ? t.color.warn
      : t.color.info;
  return (
    <View style={styles.factRow}>
      <View style={[styles.factIcon, { backgroundColor, borderRadius: t.radius.pill }]}>
        <Icon name="check" size={14} color={color} />
      </View>
      <Text style={{ flex: 1, color: t.color.textSecondary, fontSize: t.fontSize.sm, lineHeight: 20 }}>
        {text}
      </Text>
    </View>
  );
}

function Notice({
  title,
  message,
  tone,
}: {
  title: string;
  message: string;
  tone: 'warning' | 'error';
}) {
  const t = useTheme();
  return (
    <View style={[
      styles.notice,
      {
        backgroundColor: tone === 'error' ? t.color.dangerSoft : t.color.warnSoft,
        borderRadius: t.radius.xl,
      },
    ]}>
      <Text style={{ color: tone === 'error' ? t.color.danger : t.color.textPrimary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.bold }}>
        {title}
      </Text>
      <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm, lineHeight: 20, marginTop: 3 }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  intro: { gap: 10, overflow: 'hidden' },
  mark: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  decorDot: { position: 'absolute', borderRadius: 999 },
  decorDotOne: { width: 78, height: 78, right: -20, top: -22 },
  decorDotTwo: { width: 42, height: 42, right: 52, bottom: -19 },
  facts: { borderWidth: 1, padding: 18, gap: 14 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  factIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: 16 },
  actions: { gap: 10 },
  primaryButton: {
    minHeight: 54,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleMark: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
