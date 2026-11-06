import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../src/components/Icon';
import * as analytics from '../src/lib/analytics';
import { useOnboarding } from '../src/lib/onboarding';
import { useTheme } from '../src/theme';

type Slide = {
  key: string;
  /** Headline emoji-free; large bold copy. */
  title: string;
  /** One-sentence helper underneath. */
  subtitle: string;
  /** Single-icon hero centered above the title. */
  icon: IconName;
  tone: 'info' | 'warning' | 'accent';
};

const SLIDES: Slide[] = [
  {
    key: 'intro',
    title: 'Turn plans into little wins.',
    subtitle:
      'A focused task planner with optional reminders that stay on your device.',
    icon: 'tasks-filled',
    tone: 'info',
  },
  {
    key: 'schedule',
    title: 'Set it once. Let it nudge you.',
    subtitle:
      'Set a date, time, local reminder, and repeat rule without leaving the task.',
    icon: 'calendar-tab-filled',
    tone: 'warning',
  },
  {
    key: 'streak',
    title: 'A streak that tells the truth.',
    subtitle:
      'Finish a task to build your streak. Rest days hold it; missed scheduled days do not.',
    icon: 'star-filled',
    tone: 'accent',
  },
];

export default function OnboardingScreen() {
  const t = useTheme();
  const router = useRouter();
  const { markCompleted } = useOnboarding();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const { width: screenWidth } = useWindowDimensions();
  const activeTone = SLIDES[index]?.tone ?? 'accent';
  const activeColor = activeTone === 'info'
    ? t.color.info
    : activeTone === 'warning'
      ? t.color.warn
      : t.color.accent;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== index) setIndex(next);
  };

  const handleNext = async () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
      return;
    }
    await complete();
  };

  const handleSkip = async () => {
    await complete();
  };

  const complete = async () => {
    await markCompleted();
    void analytics.track('onboarding_completed', { completed_from_step: index + 1 });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm }]}>
        <View style={{ flex: 1 }} />
        {index < SLIDES.length - 1 ? (
          <Pressable onPress={handleSkip} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip">
            <Text
              style={{
                color: t.color.textMuted,
                fontSize: t.fontSize.sm,
                fontWeight: t.fontWeight.semibold,
              }}
            >
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, itemIndex) => ({
          length: screenWidth,
          offset: screenWidth * itemIndex,
          index: itemIndex,
        })}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index: itemIndex }) => {
          const color = item.tone === 'info'
            ? t.color.info
            : item.tone === 'warning'
              ? t.color.warn
              : t.color.accent;
          const soft = item.tone === 'info'
            ? t.color.infoSoft
            : item.tone === 'warning'
              ? t.color.warnSoft
              : t.color.accentMuted;
          return (
            <View style={[styles.slide, { width: screenWidth, paddingHorizontal: t.spacing['2xl'] }]}>
              <View style={[styles.scene, { backgroundColor: soft, borderRadius: t.radius['3xl'], padding: t.spacing['2xl'], ...t.elevation.sm }]}>
                <View style={[styles.sceneDot, styles.sceneDotLarge, { backgroundColor: t.color.surface }]} />
                <View style={[styles.sceneDot, styles.sceneDotSmall, { backgroundColor: t.color.surface }]} />
                <Text style={{ color, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.bold, letterSpacing: t.tracking.wider }}>
                  LITTLE WIN {itemIndex + 1} OF {SLIDES.length}
                </Text>
                <View
                  style={[
                    styles.iconBubble,
                    {
                      backgroundColor: t.color.surface,
                      borderRadius: t.radius['3xl'],
                      marginVertical: t.spacing['2xl'],
                      transform: [{ rotate: itemIndex === 1 ? '4deg' : '-4deg' }],
                    },
                  ]}
                >
                  <Icon name={item.icon} size={54} color={color} />
                </View>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontSize: t.fontSize['3xl'],
                    fontWeight: t.fontWeight.heavy,
                    letterSpacing: t.tracking.tight,
                    textAlign: 'center',
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontSize: t.fontSize.md,
                    lineHeight: t.fontSize.md * t.lineHeight.normal,
                    textAlign: 'center',
                    marginTop: t.spacing.md,
                    maxWidth: 320,
                  }}
                >
                  {item.subtitle}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.footer, { paddingHorizontal: t.spacing['2xl'], paddingBottom: t.spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === index ? activeColor : t.color.borderStrong,
                  width: i === index ? 22 : 8,
                  opacity: i === index ? 1 : 0.5,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: activeColor,
              borderRadius: t.radius['2xl'],
              ...t.elevation.md,
              shadowColor: activeColor,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={index === SLIDES.length - 1 ? 'Get started' : 'Next'}
        >
          <Text
            style={{
              color: t.color.textOnAccent,
              fontSize: t.fontSize.md,
              fontWeight: t.fontWeight.bold,
            }}
          >
            {index === SLIDES.length - 1 ? 'Start my streak' : 'Keep going'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 36,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scene: {
    width: '100%',
    maxWidth: 440,
    minHeight: 430,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sceneDot: { position: 'absolute', borderRadius: 999, opacity: 0.45 },
  sceneDotLarge: { width: 108, height: 108, right: -34, top: -28 },
  sceneDotSmall: { width: 52, height: 52, left: -18, bottom: 44 },
  iconBubble: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: 16,
    gap: 18,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cta: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
