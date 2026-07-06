import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import { SUPPORTED_LANGUAGES } from '@/constants/languages';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Check } from 'lucide-react-native';

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

export default function MainLanguageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nickname } = useLocalSearchParams<{ nickname: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handleContinue = () => {
    console.log('[Onboarding] Step 2 — main language selected:', selected);
    router.push({
      pathname: '/onboarding/target-language',
      params: { nickname, main_language: selected! },
    });
  };

  const renderItem = ({ item, index }: { item: typeof SUPPORTED_LANGUAGES[0]; index: number }) => {
    const isSelected = selected === item.code;
    return (
      <AnimatedPressable
        onPress={() => {
          console.log('[Onboarding] Main language tapped:', item.name);
          setSelected(item.code);
        }}
        style={[styles.langCard, isSelected && styles.langCardSelected]}
      >
        <Text style={styles.flag}>{item.flag}</Text>
        <Text style={[styles.langName, isSelected && styles.langNameSelected]}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.checkBadge}>
            <Check size={12} color="#FFFFFF" strokeWidth={3} />
          </View>
        )}
      </AnimatedPressable>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <ProgressDots total={4} active={1} />
        <Text style={styles.title}>What's your native language?</Text>
        <Text style={styles.subtitle}>We'll explain grammar in this language</Text>
      </View>

      <FlatList
        data={SUPPORTED_LANGUAGES}
        renderItem={renderItem}
        keyExtractor={(item) => item.code}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <AnimatedPressable
          onPress={handleContinue}
          disabled={!selected}
          style={[styles.button, !selected && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Continue</Text>
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
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  row: {
    gap: 10,
  },
  langCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  langCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  flag: {
    fontSize: 32,
    marginBottom: 8,
  },
  langName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  langNameSelected: {
    color: COLORS.primary,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
