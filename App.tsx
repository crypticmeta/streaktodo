import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/lib/auth';
import { SignInScreen } from './src/screens/SignInScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { colors } from './src/theme/colors';

function Router() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (state.status === 'signed-in') {
    return <NotificationsScreen />;
  }

  // 'signed-out' | 'unsupported' both render the sign-in screen,
  // which is responsible for explaining why a runtime might be unsupported.
  return <SignInScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
