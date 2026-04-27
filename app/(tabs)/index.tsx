import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';

export default function TasksScreen() {
  const t = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: t.color.textMuted, letterSpacing: t.tracking.wider }]}>
          Today
        </Text>
        <Text style={[styles.title, { color: t.color.textPrimary, fontSize: t.fontSize['3xl'] }]}>
          Tasks
        </Text>
        <Text style={[styles.subtitle, { color: t.color.textSecondary, fontSize: t.fontSize.base }]}>
          The task list will live here. Phase 2 wires it up.
        </Text>

        <View
          style={[
            styles.placeholderCard,
            {
              backgroundColor: t.color.surface,
              borderColor: t.color.border,
              borderRadius: t.radius['2xl'],
              padding: t.spacing['2xl'],
              marginTop: t.spacing['3xl'],
              ...t.elevation.lg,
            },
          ]}
        >
          <Text style={[styles.placeholderHeading, { color: t.color.textPrimary }]}>
            No tasks yet
          </Text>
          <Text style={[styles.placeholderBody, { color: t.color.textSecondary }]}>
            You'll be able to add tasks from a floating button once Phase 3 ships.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  eyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  title: {
    fontWeight: '700',
    marginTop: 4,
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 21,
  },
  placeholderCard: {
    borderWidth: 1,
  },
  placeholderHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholderBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
});
