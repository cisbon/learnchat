import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getProfileId } from '@/utils/storage';
import { COLORS } from '@/constants/theme';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    getProfileId().then((id) => {
      console.log('[Index] Profile ID from storage:', id);
      if (id) {
        console.log('[Index] Has profile — navigating to tabs');
        router.replace('/(tabs)/(home)');
      } else {
        console.log('[Index] No profile — navigating to onboarding');
        router.replace('/onboarding');
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}
