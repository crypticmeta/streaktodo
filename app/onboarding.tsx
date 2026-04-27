import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../src/components/Icon';
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
};

const SLIDES: Slide[] = [
  {
    key: 'intro',
    title: 'Plan once. Show up daily.',
    subtitle:
      'A todo + scheduler that nudges you exactly when it should — and only when it should.',
    icon: 'tasks-filled',
  },
  {
    key: 'schedule',
    title: 'Schedule, remind, repeat.',
    subtitle:
      'Date, time, reminder and repeat live on one sheet. Reminders actually fire — even after a reboot.',
    icon: 'calendar-tab-filled',
  },
  {
    key: 'streak',
    title: 'Honest streaks.',
    subtitle:
      "We don't fake-encourage missed days. Your streak shows what really happened.",
    icon: 'star-filled',
  },
];

export default function OnboardingScreen() {
  const t = useTheme();
  const router = useRouter();
  const { markCompleted } = useOnboarding();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const screenWidth = Dimensions.get('window').width;

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
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: screenWidth, paddingHorizontal: t.spacing['2xl'] }]}>
            <View
              style={[
                styles.iconBubble,
                {
                  backgroundColor: t.color.accentSoft,
                  borderRadius: 999,
                  marginBottom: t.spacing['2xl'],
                },
              ]}
            >
              <Icon name={item.icon} size={56} color={t.color.accent} />
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
        )}
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
                    i === index ? t.color.accent : t.color.borderStrong,
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
              backgroundColor: t.color.accent,
              borderRadius: t.radius['2xl'],
              ...t.elevation.md,
              shadowColor: t.color.accent,
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
            {index === SLIDES.length - 1 ? 'Get started' : 'Next'}
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
