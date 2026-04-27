import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateCategoryDialog } from '../src/components/CreateCategoryDialog';
import { EditCategoryDialog } from '../src/components/EditCategoryDialog';
import { Icon } from '../src/components/Icon';
import { categoriesRepo, useCategories, type Category } from '../src/db';
import { subscribe } from '../src/db/events';
import { useTheme } from '../src/theme';

const UNCATEGORIZED_FALLBACK = '#9a8f81';

export default function CategoriesScreen() {
  const t = useTheme();
  const router = useRouter();
  const { categories } = useCategories();

  // Per-category task counts. Re-fetched whenever categories OR tasks change,
  // so deleting a category (which moves tasks to "no category") updates the
  // remaining rows' "N tasks" subtext immediately.
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await categoriesRepo.countTasksByCategory();
      if (!cancelled) setCounts(next);
    };
    refresh();
    const unsubTasks = subscribe('tasks-changed', refresh);
    const unsubCats = subscribe('categories-changed', refresh);
    return () => {
      cancelled = true;
      unsubTasks();
      unsubCats();
    };
  }, []);

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async ({ name, color }: { name: string; color: string }) => {
    await categoriesRepo.createCategory({ name, color, sortOrder: categories.length });
    setCreating(false);
  };

  const handleSaveEdit = async ({ name, color }: { name: string; color: string }) => {
    if (!editing) return;
    await categoriesRepo.updateCategory(editing.id, { name, color });
    setEditing(null);
  };

  const confirmDelete = (cat: Category) => {
    const taskCount = counts.get(cat.id) ?? 0;
    const message =
      taskCount > 0
        ? `${taskCount} task${taskCount === 1 ? '' : 's'} will lose this category. The tasks themselves stay.`
        : 'This category will be removed.';
    Alert.alert(`Delete "${cat.name}"?`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          // Fire-and-forget — repo emits events that refresh the list.
          void categoriesRepo.softDeleteCategory(cat.id);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingHorizontal: t.spacing.xl }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="close" size={26} color={t.color.textPrimary} />
        </Pressable>
        <Text
          style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize.xl,
            fontWeight: t.fontWeight.heavy,
            letterSpacing: t.tracking.tight,
            flex: 1,
            marginLeft: t.spacing.md,
          }}
        >
          Categories
        </Text>
        <Pressable
          onPress={() => setCreating(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Add category"
          style={[
            styles.addBtn,
            {
              backgroundColor: t.color.accent,
              borderRadius: 999,
            },
          ]}
        >
          <Icon name="plus" size={18} color={t.color.textOnAccent} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          {
            paddingHorizontal: t.spacing.xl,
            paddingTop: t.spacing.lg,
            paddingBottom: t.spacing['6xl'],
            gap: t.spacing.sm,
          },
        ]}
      >
        {categories.length === 0 ? (
          <Text style={{ color: t.color.textMuted, textAlign: 'center', marginTop: 40 }}>
            No categories yet. Tap + to add one.
          </Text>
        ) : (
          categories.map((cat) => {
            const taskCount = counts.get(cat.id) ?? 0;
            return (
              <View
                key={cat.id}
                style={[
                  styles.row,
                  {
                    backgroundColor: t.color.surface,
                    borderRadius: t.radius.lg,
                    padding: t.spacing.md,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: cat.color ?? UNCATEGORIZED_FALLBACK },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontSize: t.fontSize.md,
                      fontWeight: t.fontWeight.semibold,
                    }}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                  <Text
                    style={{
                      color: t.color.textMuted,
                      fontSize: t.fontSize.xs,
                      marginTop: 2,
                    }}
                  >
                    {taskCount === 0
                      ? 'No tasks'
                      : taskCount === 1
                        ? '1 task'
                        : `${taskCount} tasks`}
                    {cat.isDefault ? ' · default' : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setEditing(cat)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${cat.name}`}
                  style={styles.iconBtn}
                >
                  <Icon name="edit" size={18} color={t.color.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(cat)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${cat.name}`}
                  style={styles.iconBtn}
                >
                  <Icon name="trash" size={18} color={t.color.danger} />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <CreateCategoryDialog
        visible={creating}
        onCancel={() => setCreating(false)}
        onCreate={handleCreate}
      />

      <EditCategoryDialog
        visible={editing !== null}
        initial={editing ? { name: editing.name, color: editing.color } : null}
        onCancel={() => setEditing(null)}
        onSave={handleSaveEdit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 52,
  },
  addBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
