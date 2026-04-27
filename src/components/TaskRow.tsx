import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task } from '../db';
import { formatRelativeShort, formatTimeFromMinutes, isOverdue } from '../lib/date';
import { useTheme } from '../theme';

export type TaskRowCategory = {
  name: string;
  color: string | null;
};

export type TaskRowProps = {
  task: Task;
  category: TaskRowCategory | null;
  subtaskCounts?: { total: number; done: number };
  hasReminder?: boolean;
  hasRepeat?: boolean;
  onToggleComplete: (taskId: string, nextStatus: 'done' | 'pending') => void;
  onTogglePin: (taskId: string, nextPinned: boolean) => void;
};

function TaskRowImpl({
  task,
  category,
  subtaskCounts,
  hasReminder,
  hasRepeat,
  onToggleComplete,
  onTogglePin,
}: TaskRowProps) {
  const t = useTheme();
  const isDone = task.status === 'done';
  const overdue = !isDone && task.dueAt !== null && isOverdue(task.dueAt);

  const handleToggleComplete = () => {
    onToggleComplete(task.id, isDone ? 'pending' : 'done');
  };

  const handleTogglePin = () => {
    onTogglePin(task.id, !task.isPinned);
  };

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: t.color.surface,
          borderColor: task.isPinned ? t.color.accent : t.color.border,
          borderRadius: t.radius.lg,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.md,
        },
      ]}
    >
      {/* Completion checkbox circle */}
      <Pressable
        onPress={handleToggleComplete}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={isDone ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        style={[
          styles.checkbox,
          {
            borderColor: isDone ? t.color.accent : t.color.borderStrong,
            backgroundColor: isDone ? t.color.accent : 'transparent',
          },
        ]}
      >
        {isDone ? (
          <Text style={{ color: t.color.textOnAccent, fontSize: 14, fontWeight: '700' }}>✓</Text>
        ) : null}
      </Pressable>

      {/* Body: title + meta */}
      <View style={styles.body}>
        <Text
          numberOfLines={3}
          style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize.md,
            fontWeight: t.fontWeight.medium,
            textDecorationLine: isDone ? 'line-through' : 'none',
            opacity: isDone ? 0.55 : 1,
          }}
        >
          {task.title}
        </Text>

        <Meta
          task={task}
          category={category}
          subtaskCounts={subtaskCounts}
          hasReminder={hasReminder}
          hasRepeat={hasRepeat}
          overdue={overdue}
        />
      </View>

      {/* Pin / star action */}
      <Pressable
        onPress={handleTogglePin}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={task.isPinned ? 'Unpin task' : 'Pin task'}
        accessibilityState={{ selected: task.isPinned }}
        style={styles.pinButton}
      >
        <Text
          style={{
            fontSize: 20,
            color: task.isPinned ? t.color.accent : t.color.borderStrong,
          }}
        >
          {task.isPinned ? '★' : '☆'}
        </Text>
      </Pressable>
    </View>
  );
}

function Meta({
  task,
  category,
  subtaskCounts,
  hasReminder,
  hasRepeat,
  overdue,
}: {
  task: Task;
  category: TaskRowCategory | null;
  subtaskCounts?: { total: number; done: number };
  hasReminder?: boolean;
  hasRepeat?: boolean;
  overdue: boolean;
}) {
  const t = useTheme();

  const dateText = task.dueAt !== null ? formatRelativeShort(task.dueAt) : null;
  const timeText = task.dueTime !== null ? formatTimeFromMinutes(task.dueTime) : null;

  // Build the right-side meta list. Date is rendered first because it carries
  // its own color (overdue → danger). Everything else is muted.
  const tail: string[] = [];
  if (subtaskCounts && subtaskCounts.total > 0) {
    tail.push(
      `${subtaskCounts.done}/${subtaskCounts.total} subtask${subtaskCounts.total === 1 ? '' : 's'}`
    );
  }
  if (category) tail.push(category.name);

  const showMeta =
    dateText !== null ||
    timeText !== null ||
    tail.length > 0 ||
    hasReminder ||
    hasRepeat ||
    category !== null;

  if (!showMeta) return null;

  return (
    <View style={styles.metaRow}>
      {/* Category dot — always first when present, even before date */}
      {category ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: category.color ?? t.color.borderStrong,
            marginRight: 6,
          }}
        />
      ) : null}

      {dateText !== null ? (
        <Text
          style={{
            color: overdue ? t.color.danger : t.color.textMuted,
            fontSize: t.fontSize.xs,
            fontWeight: overdue ? t.fontWeight.semibold : t.fontWeight.regular,
          }}
        >
          {dateText}
          {timeText ? ` · ${timeText}` : ''}
        </Text>
      ) : null}

      {hasReminder ? (
        <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, marginLeft: 6 }}>
          🔔
        </Text>
      ) : null}
      {hasRepeat ? (
        <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, marginLeft: 4 }}>
          🔁
        </Text>
      ) : null}

      {tail.length > 0 ? (
        <Text
          style={{
            color: t.color.textMuted,
            fontSize: t.fontSize.xs,
            marginLeft: dateText || hasReminder || hasRepeat ? 6 : 0,
          }}
        >
          {dateText || hasReminder || hasRepeat ? '· ' : ''}
          {tail.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

// Memo: a re-render of the list shouldn't repaint every row. Custom equality
// catches the most common change shapes (status, pin, title, due fields, meta).
export const TaskRow = memo(TaskRowImpl, (prev, next) => {
  if (prev.task !== next.task) return false;
  if (prev.category !== next.category) return false;
  if (prev.hasReminder !== next.hasReminder) return false;
  if (prev.hasRepeat !== next.hasRepeat) return false;
  const a = prev.subtaskCounts;
  const b = next.subtaskCounts;
  if ((a === undefined) !== (b === undefined)) return false;
  if (a && b && (a.total !== b.total || a.done !== b.done)) return false;
  // Callback identity is allowed to change every render; we don't capture state
  // from them inside the row.
  return true;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.75,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  pinButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: -2,
  },
});
