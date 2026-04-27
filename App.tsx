import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/lib/auth';
import { SignInScreen } from './src/screens/SignInScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ThemeProvider, useTheme } from './src/theme';

function Router() {
  const { state } = useAuth();
  const theme = useTheme();

  if (state.status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.color.background }]}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  if (state.status === 'signed-in') {
    return <NotificationsScreen />;
  }

  return <SignInScreen />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router />
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
