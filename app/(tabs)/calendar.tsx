import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';

export default function CalendarScreen() {
  const t = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: t.color.textMuted, letterSpacing: t.tracking.wider }]}>
          Plan ahead
        </Text>
        <Text style={[styles.title, { color: t.color.textPrimary, fontSize: t.fontSize['3xl'] }]}>
          Calendar
        </Text>
        <Text style={[styles.subtitle, { color: t.color.textSecondary, fontSize: t.fontSize.base }]}>
          Month view with task and reminder dots arrives in Phase 9.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  eyebrow: { fontSize: 11, textTransform: 'uppercase', fontWeight: '600' },
  title: { fontWeight: '700', marginTop: 4 },
  subtitle: { marginTop: 4, lineHeight: 21 },
});
