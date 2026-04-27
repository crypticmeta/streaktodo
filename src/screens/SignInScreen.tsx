import { Pressable, StyleSheet, Text, View } from 'react-native';
import { branding } from '../../branding';
import { useAuth } from '../lib/auth';
import { colors } from '../theme/colors';

export function SignInScreen() {
  const { state, signIn } = useAuth();

  const isLoading = state.status === 'loading';
  const isUnsupported = state.status === 'unsupported';
  const error = state.status === 'signed-out' ? state.error : null;

  return (
    <View style={styles.container}>
      <View style={styles.shell}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Welcome</Text>
          <Text style={styles.title}>{branding.appName}</Text>
          <Text style={styles.subtitle}>
            Sign in to plan content, schedule tasks, and keep a streak.
          </Text>

          {isUnsupported ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>Unsupported runtime</Text>
              <Text style={styles.helperText}>{state.reason}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.messageBox, styles.messageBoxMuted]}>
              <Text style={styles.messageTitle}>Sign-in error</Text>
              <Text style={styles.helperText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[styles.button, (isLoading || isUnsupported) && styles.buttonDisabled]}
          onPress={signIn}
          disabled={isLoading || isUnsupported}
        >
          <Text style={styles.buttonTitle}>Sign in with Google</Text>
          <Text style={styles.buttonCaption}>
            {isLoading ? 'Restoring session…' : 'Uses your Google account'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#6f4e37',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 8,
  },
  messageBox: {
    marginTop: 18,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8eddc',
    borderWidth: 1,
    borderColor: '#ead7b7',
  },
  messageBoxMuted: {
    backgroundColor: colors.muted,
    borderColor: colors.mutedBorder,
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2f261f',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5f5246',
    marginTop: 8,
    textAlign: 'left',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 22,
    alignItems: 'flex-start',
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonTitle: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonCaption: {
    color: colors.textOnPrimarySoft,
    fontSize: 13,
    marginTop: 4,
  },
});
