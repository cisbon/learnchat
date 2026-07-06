import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import { CEFR_LEVELS, SUPPORTED_LANGUAGES } from '@/constants/languages';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function ProgressDots({ total, active }: { total: number; active: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === active ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

export default function CefrLevelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nickname, main_language, target_language } = useLocalSearchParams<{
    nickname: string;
    main_language: string;
    target_language: string;
  }>();
  const [selected, setSelected] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const targetLang = SUPPORTED_LANGUAGES.find((l) => l.code === target_language);
  const targetName = targetLang ? targetLang.name : target_language;

  const handleStart = () => {
    console.log('[Onboarding] Step 4 — CEFR level selected:', selected);
    router.push({
      pathname: '/onboarding/complete',
      params: { nickname, main_language, target_language, cefr_level: selected! },
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <ProgressDots total={4} active={3} />
        <Text style={styles.title}>What's your current level?</Text>
        <Text style={styles.subtitle}>
          in <Text style={styles.subtitleHighlight}>{targetName}</Text>
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {CEFR_LEVELS.map((level) => {
          const isSelected = selected === level.code;
          return (
            <AnimatedPressable
              key={level.code}
              onPress={() => {
                console.log('[Onboarding] CEFR level tapped:', level.code);
                setSelected(level.code);
              }}
              style={[styles.levelCard, isSelected && styles.levelCardSelected]}
            >
              <View style={styles.levelLeft}>
                <Text style={[styles.levelCode, isSelected && styles.levelCodeSelected]}>
                  {level.code}
                </Text>
              </View>
              <View style={styles.levelRight}>
                <Text style={[styles.levelLabel, isSelected && styles.levelLabelSelected]}>
                  {level.label}
                </Text>
                <Text style={[styles.levelDesc, isSelected && styles.levelDescSelected]}>
                  {level.description}
                </Text>
              </View>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <AnimatedPressable
          onPress={handleStart}
          disabled={!selected}
          style={[styles.button, !selected && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Start Learning</Text>
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  dotInactive: {
    backgroundColor: COLORS.border,
    borderWidth: 1.5,
    borderColor: COLORS.textTertiary,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  subtitleHighlight: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 10,
  },
  levelCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  levelCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  levelLeft: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelCode: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  levelCodeSelected: {
    color: '#FFFFFF',
  },
  levelRight: {
    flex: 1,
  },
  levelLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  levelLabelSelected: {
    color: '#FFFFFF',
  },
  levelDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  levelDescSelected: {
    color: 'rgba(255,255,255,0.75)',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: COLORS.background,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
