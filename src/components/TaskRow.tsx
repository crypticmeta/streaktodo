import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Subtask, Task } from '../db';
import { formatRelativeShort, formatTimeFromMinutes, isOverdue } from '../lib/date';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export type TaskRowCategory = {
  name: string;
  color: string | null;
};

export type TaskRowProps = {
  task: Task;
  category: TaskRowCategory | null;
  subtasks?: Subtask[];
  subtaskCounts?: { total: number; done: number };
  hasReminder?: boolean;
  hasRepeat?: boolean;
  onToggleComplete: (taskId: string, nextStatus: 'done' | 'pending') => void;
  onToggleSubtaskComplete?: (subtaskId: string, nextStatus: 'done' | 'pending') => void;
  onTogglePin: (taskId: string, nextPinned: boolean) => void;
  /** Tap on the row body (NOT the checkbox or pin) opens the editor. */
  onPress?: (taskId: string) => void;
};

function TaskRowImpl({
  task,
  category,
  subtasks,
  subtaskCounts,
  hasReminder,
  hasRepeat,
  onToggleComplete,
  onToggleSubtaskComplete,
  onTogglePin,
  onPress,
}: TaskRowProps) {
  const t = useTheme();
  const isDone = task.status === 'done';
  const overdue = !isDone && task.dueAt !== null && isOverdue(task.dueAt);

  // Completion animations.
  // - titleProgress: 0 = pending, 1 = done. Drives title opacity dim. Strike-
  //   through stays static (textDecorationLine isn't animatable) but the
  //   opacity dim carries most of the visual weight.
  // - checkboxScale: pulse on toggle to done; smooth ease back to 1 on undone.
  const titleProgress = useRef(new Animated.Value(isDone ? 1 : 0)).current;
  const checkboxScale = useRef(new Animated.Value(1)).current;
  // Skip the very first effect run so rows that mount in a "done" state
  // don't pulse on scroll-in. The animation only fires on actual toggles.
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      titleProgress.setValue(isDone ? 1 : 0);
      return;
    }

    Animated.timing(titleProgress, {
      toValue: isDone ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (isDone) {
      Animated.sequence([
        Animated.timing(checkboxScale, {
          toValue: 1.18,
          duration: 110,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(checkboxScale, {
          toValue: 1,
          duration: 130,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Resetting: brief gentle settle without the overshoot.
      Animated.timing(checkboxScale, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [isDone, titleProgress, checkboxScale]);

  const titleOpacity = titleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
  });

  const handleToggleComplete = () => {
    onToggleComplete(task.id, isDone ? 'pending' : 'done');
  };

  const handleTogglePin = () => {
    onTogglePin(task.id, !task.isPinned);
  };

  // Compose a screen-reader label that surfaces information the visual row
  // de-emphasizes — category name (we removed it from the meta tail) and
  // overdue state (which is now a colored stripe + pill, both invisible to
  // assistive tech that doesn't read color).
  const a11yLabel = (() => {
    const parts: string[] = [task.title];
    if (overdue) parts.push('overdue');
    if (category) parts.push(category.name);
    if (task.dueAt !== null) parts.push(`due ${formatRelativeShort(task.dueAt)}`);
    if (task.dueTime !== null) parts.push(`at ${formatTimeFromMinutes(task.dueTime)}`);
    if (task.notes !== null && task.notes.trim().length > 0) parts.push('has notes');
    if (task.isPinned) parts.push('pinned');
    return parts.join(', ');
  })();

  // Pinned rows already shout via the accentSoft tint; layering a danger stripe
  // on top would visually fight. Pinned-and-overdue is rare; if it happens we
  // lean on the red date text + Overdue pill instead of the stripe.
  const showOverdueStripe = overdue && !task.isPinned;

  return (
    <View
      style={[
        styles.row,
        {
          // Filled card — no visible border. Pinned rows get the soft accent
          // tint as a quiet differentiator instead of a stroke.
          backgroundColor: task.isPinned ? t.color.accentSoft : t.color.surfaceMuted,
          borderRadius: t.radius.lg,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.lg,
          // Clip the overdue stripe to the rounded corners.
          overflow: 'hidden',
        },
      ]}
    >
      {showOverdueStripe ? (
        <View
          pointerEvents="none"
          style={[styles.overdueStripe, { backgroundColor: t.color.danger }]}
        />
      ) : null}

      {/* Completion checkbox — selected state per design system:
          accent fill + 1.75px WHITE outline + check in textOnAccent.
          The white outline keeps the circle readable on both surfaceMuted
          rows AND the accentSoft fill of pinned rows.
          Wrapped in an Animated.View so toggling pulses the scale; the
          Pressable handles input as before. */}
      <Animated.View style={{ transform: [{ scale: checkboxScale }] }}>
        <Pressable
          onPress={handleToggleComplete}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDone }}
          accessibilityLabel={isDone ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          style={[
            styles.checkbox,
            {
              // Three-state border:
              //   done       → white (sits on the accent fill)
              //   pinned     → textPrimary (passes 3:1 against accentSoft;
              //                borderStrong fails 2.06:1 there)
              //   default    → borderStrong (passes 3:1 on surfaceMuted)
              borderColor: isDone
                ? '#ffffff'
                : task.isPinned
                  ? t.color.textPrimary
                  : t.color.borderStrong,
              backgroundColor: isDone ? t.color.accent : 'transparent',
            },
          ]}
        >
          {isDone ? <Icon name="check" size={14} color={t.color.textOnAccent} /> : null}
        </Pressable>
      </Animated.View>

      {/* Body: title + meta. Tappable when onPress is supplied — opens the editor. */}
      <Pressable
        onPress={onPress ? () => onPress(task.id) : undefined}
        // Disable the press visual when there's no editor wired so the row
        // still looks the same on screens that don't pass onPress.
        disabled={!onPress}
        style={styles.body}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? a11yLabel : undefined}
        accessibilityHint={onPress ? 'Opens the editor' : undefined}
      >
        <Animated.Text
          numberOfLines={3}
          style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize.md,
            fontWeight: t.fontWeight.medium,
            // Strike-through is static — textDecorationLine isn't an
            // animatable property — but the opacity dim carries most of the
            // visual weight of the toggle.
            textDecorationLine: isDone ? 'line-through' : 'none',
            opacity: titleOpacity,
          }}
        >
          {task.title}
        </Animated.Text>

        <Meta
          task={task}
          category={category}
          subtaskCounts={subtaskCounts}
          hasReminder={hasReminder}
          hasRepeat={hasRepeat}
          overdue={overdue}
        />

        {subtasks && subtasks.length > 0 ? (
          <View style={[styles.subtasksBlock, { borderTopColor: t.color.borderStrong }]}>
            {subtasks.map((subtask) => {
              const subtaskDone = subtask.status === 'done';
              return (
                <Pressable
                  key={subtask.id}
                  onPress={() =>
                    onToggleSubtaskComplete?.(
                      subtask.id,
                      subtaskDone ? 'pending' : 'done'
                    )
                  }
                  disabled={!onToggleSubtaskComplete}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: subtaskDone }}
                  accessibilityLabel={
                    subtaskDone
                      ? `Mark subtask ${subtask.title} as not done`
                      : `Mark subtask ${subtask.title} as done`
                  }
                  style={styles.subtaskRow}
                >
                  <View
                    style={[
                      styles.subtaskCheckbox,
                      {
                        borderColor: subtaskDone ? t.color.accent : t.color.borderStrong,
                        backgroundColor: subtaskDone ? t.color.accent : 'transparent',
                      },
                    ]}
                  >
                    {subtaskDone ? (
                      <Icon name="check" size={11} color={t.color.textOnAccent} />
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      flex: 1,
                      color: t.color.textSecondary,
                      fontSize: t.fontSize.sm,
                      textDecorationLine: subtaskDone ? 'line-through' : 'none',
                      opacity: subtaskDone ? 0.6 : 1,
                    }}
                  >
                    {subtask.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Pressable>

      {/* Pin action — star glyph; outlined when unpinned, filled when pinned. */}
      <Pressable
        onPress={handleTogglePin}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={task.isPinned ? 'Unpin task' : 'Pin task'}
        accessibilityState={{ selected: task.isPinned }}
        style={styles.pinButton}
      >
        <Icon
          name={task.isPinned ? 'star-filled' : 'star'}
          size={20}
          color={task.isPinned ? t.color.accent : t.color.textMuted}
        />
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
  const hasSubtasks = subtaskCounts !== undefined && subtaskCounts.total > 0;
  const hasNotes = task.notes !== null && task.notes.trim().length > 0;

  const showMeta =
    overdue ||
    dateText !== null ||
    timeText !== null ||
    hasSubtasks ||
    hasReminder ||
    hasRepeat ||
    hasNotes ||
    category !== null;

  if (!showMeta) return null;

  return (
    <View style={styles.metaRow}>
      {/* Overdue pill — first so the eye lands on it before the date. The
          colored dot still appears for category, but the badge is the
          dominant signal. */}
      {overdue ? (
        <View
          style={[
            styles.metaChip,
            { backgroundColor: t.color.dangerSoft, marginRight: 6 },
          ]}
        >
          <Text
            style={{
              color: t.color.danger,
              fontSize: t.fontSize.xs,
              fontWeight: t.fontWeight.semibold,
              letterSpacing: t.tracking.wide,
              textTransform: 'uppercase',
            }}
          >
            Overdue
          </Text>
        </View>
      ) : null}

      {/* Category dot — encodes category by color; we drop the textual name
          from the tail to keep meta line tight. */}
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
        <View style={{ marginLeft: 6 }}>
          <Icon name="reminder-filled" size={12} color={t.color.textMuted} />
        </View>
      ) : null}
      {hasRepeat ? (
        <View style={{ marginLeft: 4 }}>
          <Icon name="repeat-filled" size={12} color={t.color.textMuted} />
        </View>
      ) : null}
      {hasNotes ? (
        <View style={{ marginLeft: 4 }}>
          <Icon name="note" size={12} color={t.color.textMuted} />
        </View>
      ) : null}

      {hasSubtasks ? (
        <View
          style={[
            styles.metaChip,
            {
              backgroundColor: t.color.accentSoft,
              marginLeft: dateText || hasReminder || hasRepeat ? 6 : 0,
            },
          ]}
        >
          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize.xs,
              fontWeight: t.fontWeight.semibold,
              fontVariant: ['tabular-nums'],
            }}
          >
            {subtaskCounts!.done}/{subtaskCounts!.total}
          </Text>
        </View>
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
  const prevSubtasks = prev.subtasks;
  const nextSubtasks = next.subtasks;
  if ((prevSubtasks === undefined) !== (nextSubtasks === undefined)) return false;
  if (prevSubtasks && nextSubtasks) {
    if (prevSubtasks.length !== nextSubtasks.length) return false;
    for (let i = 0; i < prevSubtasks.length; i += 1) {
      const aSub = prevSubtasks[i]!;
      const bSub = nextSubtasks[i]!;
      if (
        aSub.id !== bSub.id ||
        aSub.title !== bSub.title ||
        aSub.status !== bSub.status ||
        aSub.sortOrder !== bSub.sortOrder
      ) {
        return false;
      }
    }
  }
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
  overdueStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  metaChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subtasksBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  subtaskCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
