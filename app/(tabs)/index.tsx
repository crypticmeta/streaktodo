import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from '../../src/components/Fab';
import { TaskComposer } from '../../src/components/TaskComposer';
import { subtasksRepo, tasksRepo, useTasks } from '../../src/db';
import { useTheme } from '../../src/theme';

// Phase 2 surface: persistence + composer subtasks work, but the polished
// row UI (checkbox in row, pin star, metadata line, day grouping) is the
// next checkbox. Until then we render a minimal proof-of-life list so we
// can see the data flow.
export default function TasksScreen() {
  const t = useTheme();
  const [composerOpen, setComposerOpen] = useState(false);
  const { tasks, loading, error, refresh } = useTasks({ status: 'all' });
  const [subtaskCounts, setSubtaskCounts] = useState<
    Record<string, { total: number; done: number }>
  >({});

  // Reload subtask counts whenever the task list changes.
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const counts = await subtasksRepo.countsByTaskIds(taskIds);
      if (!cancelled) setSubtaskCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [taskIds]);

  const handleSubmit = useCallback(
    async ({ title, subtasks }: { title: string; subtasks: string[] }) => {
      await tasksRepo.createTaskWithSubtasks({ title }, subtasks);
      await refresh();
    },
    [refresh]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: t.spacing['6xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.eyebrow, { color: t.color.textMuted, letterSpacing: t.tracking.wider }]}>
          Today
        </Text>
        <Text style={[styles.title, { color: t.color.textPrimary, fontSize: t.fontSize['3xl'] }]}>
          Tasks
        </Text>

        {loading ? (
          <Text style={[styles.subtitle, { color: t.color.textSecondary, fontSize: t.fontSize.base }]}>
            Loading…
          </Text>
        ) : error ? (
          <Text style={[styles.subtitle, { color: t.color.danger, fontSize: t.fontSize.base }]}>
            {error}
          </Text>
        ) : tasks.length === 0 ? (
          <>
            <Text style={[styles.subtitle, { color: t.color.textSecondary, fontSize: t.fontSize.base }]}>
              Tap the + button to add your first task.
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
                The list will appear here once you create one.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: t.color.textSecondary, fontSize: t.fontSize.base }]}>
              {tasks.length} task{tasks.length === 1 ? '' : 's'}
            </Text>

            <View style={{ marginTop: t.spacing['2xl'], gap: t.spacing.sm }}>
              {tasks.map((task) => {
                const counts = subtaskCounts[task.id];
                return (
                  <View
                    key={task.id}
                    style={{
                      backgroundColor: t.color.surface,
                      borderColor: t.color.border,
                      borderWidth: 1,
                      borderRadius: t.radius.lg,
                      paddingHorizontal: t.spacing.lg,
                      paddingVertical: t.spacing.md,
                    }}
                  >
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontSize: t.fontSize.md,
                        fontWeight: t.fontWeight.medium,
                        textDecorationLine: task.status === 'done' ? 'line-through' : 'none',
                        opacity: task.status === 'done' ? 0.55 : 1,
                      }}
                    >
                      {task.title}
                    </Text>
                    {counts && counts.total > 0 ? (
                      <Text
                        style={{
                          color: t.color.textMuted,
                          fontSize: t.fontSize.xs,
                          marginTop: 4,
                        }}
                      >
                        {counts.done}/{counts.total} subtask{counts.total === 1 ? '' : 's'}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Fab
        onPress={() => setComposerOpen(true)}
        accessibilityLabel="Add task"
        hint="Opens the task composer"
      />

      <TaskComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
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
