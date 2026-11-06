import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { tasksRepo, useTasks, type Task } from '../src/db';
import { formatLongDate } from '../src/lib/date';
import * as scheduler from '../src/lib/notificationScheduler';
import { useTheme } from '../src/theme';

export default function TrashScreen() {
  const t = useTheme();
  const router = useRouter();
  const { tasks, loading, error, refresh } = useTasks({ status: 'all', deleted: 'only', pinnedFirst: false });
  const [workingTaskId, setWorkingTaskId] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);

  const restore = useCallback(async (task: Task) => {
    if (workingTaskId) return;
    setWorkingTaskId(task.id);
    try {
      await tasksRepo.restoreTask(task.id);
      const restored = await tasksRepo.getTaskById(task.id);
      if (!restored) throw new Error('The restored task could not be read.');
      const result = await scheduler.scheduleForTask({
        taskId: restored.id,
        taskTitle: restored.title,
        taskDueAt: restored.dueAt,
        taskDueTime: restored.dueTime,
      });
      if (result.state !== 'scheduled' && result.state !== 'no_reminders' && result.message) {
        Alert.alert('Task restored; reminder needs attention', result.message);
      }
    } catch (error) {
      Alert.alert(
        'Couldn’t restore task',
        error instanceof Error ? error.message : 'Try again in a moment.'
      );
    } finally {
      setWorkingTaskId(null);
    }
  }, [workingTaskId]);

  const removeForever = useCallback((task: Task) => {
    if (workingTaskId) return;
    Alert.alert(
      'Delete permanently?',
      `“${task.title}” and its task details cannot be recovered.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            setWorkingTaskId(task.id);
            void tasksRepo.permanentlyDeleteTask(task.id)
              .catch((error) => {
                Alert.alert(
                  'Couldn’t delete task',
                  error instanceof Error ? error.message : 'Try again in a moment.'
                );
              })
              .finally(() => setWorkingTaskId(null));
          },
        },
      ]
    );
  }, [workingTaskId]);

  const emptyTrash = () => {
    if (tasks.length === 0 || emptying || workingTaskId) return;
    Alert.alert('Empty Trash?', 'All recently deleted tasks will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Empty Trash',
        style: 'destructive',
        onPress: () => {
          setEmptying(true);
          void tasksRepo.emptyTrash()
            .catch((error) => {
              Alert.alert(
                'Couldn’t empty Trash',
                error instanceof Error ? error.message : 'Try again in a moment.'
              );
            })
            .finally(() => setEmptying(false));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.lg }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize['2xl'] }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize['2xl'], fontWeight: t.fontWeight.heavy }}>
            Recently deleted
          </Text>
          <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm }}>
            Restore a task or remove it forever.
          </Text>
        </View>
        {tasks.length > 0 ? (
          <Pressable onPress={emptyTrash} accessibilityRole="button" accessibilityLabel="Empty Trash">
            <Text style={{ color: t.color.danger, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.semibold }}>
              Empty
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(task) => task.id}
        contentContainerStyle={{ paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing['3xl'], flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: t.color.surface, borderRadius: t.radius.lg, padding: t.spacing.lg }]}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ color: t.color.textPrimary, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
                {item.title}
              </Text>
              <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, marginTop: 4 }}>
                Deleted {item.deletedAt ? formatLongDate(item.deletedAt) : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => { void restore(item); }}
              disabled={workingTaskId !== null || emptying}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Restore ${item.title}`}
              style={({ pressed }) => [
                styles.action,
                {
                  backgroundColor: pressed ? t.color.accentMuted : t.color.accentSoft,
                  borderRadius: t.radius.pill,
                  opacity: workingTaskId === item.id ? 0.5 : 1,
                },
              ]}
            >
              <Icon name="restore" size={17} color={t.color.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => removeForever(item)}
              disabled={workingTaskId !== null || emptying}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.title} permanently`}
              style={({ pressed }) => [styles.action, { backgroundColor: pressed ? t.color.dangerSoft : 'transparent', borderRadius: t.radius.pill }]}
            >
              <Icon name="trash" size={17} color={t.color.danger} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.bold }}>
              {error ? 'Couldn’t load Trash' : 'Trash is empty'}
            </Text>
            <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm, marginTop: 6, textAlign: 'center' }}>
              {error ?? 'Deleted tasks will appear here so you can restore them.'}
            </Text>
            {error ? (
              <Pressable
                onPress={() => { void refresh(); }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading Trash"
                style={{ marginTop: t.spacing.md, padding: t.spacing.sm }}
              >
                <Text style={{ color: t.color.accent, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.bold }}>
                  Try again
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        refreshing={loading}
        onRefresh={() => { void refresh(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
});
