import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import { apiRequest, Profile, LearningLanguage } from '@/utils/api';
import { setProfileId, setProfile, setActiveLanguage } from '@/utils/storage';
import { useApp } from '@/contexts/AppContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';

export default function OnboardingComplete() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nickname, main_language, target_language, cefr_level } = useLocalSearchParams<{
    nickname: string;
    main_language: string;
    target_language: string;
    cefr_level: string;
  }>();
  const { refreshProfile } = useApp();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const runSetup = async () => {
    try {
      setStatus('loading');
      console.log('[Onboarding] Complete — creating profile:', { nickname, main_language });
      const profile = await apiRequest<Profile>('/api/profiles', {
        method: 'POST',
        body: JSON.stringify({ nickname, main_language }),
      });

      console.log('[Onboarding] Complete — adding language:', { target_language, cefr_level });
      const lang = await apiRequest<LearningLanguage>(`/api/profiles/${profile.id}/languages`, {
        method: 'POST',
        body: JSON.stringify({ target_language, cefr_level }),
      });

      await Promise.all([
        setProfileId(profile.id),
        setProfile(profile),
        setActiveLanguage(lang),
      ]);

      await refreshProfile();
      setStatus('success');

      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        console.log('[Onboarding] Complete — redirecting to tabs');
        router.replace('/(tabs)/(home)');
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      console.error('[Onboarding] Complete — error:', msg);
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  useEffect(() => {
    runSetup();
  }, []);

  if (status === 'loading') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Setting up your profile…</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingHorizontal: 32 }]}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorTitle}>Couldn't create your profile</Text>
        <Text style={styles.errorMsg}>{errorMsg}</Text>
        <AnimatedPressable onPress={runSetup} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          alignItems: 'center',
        }}
      >
        <View style={styles.successCircle}>
          <Text style={styles.successEmoji}>✅</Text>
        </View>
        <Text style={styles.successTitle}>You're all set!</Text>
        <Text style={styles.successSubtitle}>
          Your language journey starts now
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  errorEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMsg: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 52,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
