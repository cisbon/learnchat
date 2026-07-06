import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
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

export default function OnboardingWelcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nickname, setNickname] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = () => {
    console.log('[Onboarding] Step 1 — nickname entered:', nickname.trim());
    router.push({ pathname: '/onboarding/main-language', params: { nickname: nickname.trim() } });
  };

  const isValid = nickname.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
          <ProgressDots total={4} active={0} />

          <View style={styles.heroSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🌍</Text>
            </View>
            <Text style={styles.appName}>learnchat</Text>
            <Text style={styles.subtitle}>
              Learn languages through{'\n'}natural conversation
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>What's your name?</Text>
            <TextInput
              style={styles.input}
              placeholder="Your nickname"
              placeholderTextColor={COLORS.textTertiary}
              value={nickname}
              onChangeText={setNickname}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={isValid ? handleContinue : undefined}
            />
          </View>

          <AnimatedPressable
            onPress={handleContinue}
            disabled={!isValid}
            style={[styles.button, !isValid && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 48,
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
  heroSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoEmoji: {
    fontSize: 44,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  formSection: {
    marginBottom: 32,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
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
