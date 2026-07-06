import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { COLORS } from '@/constants/theme';

const TABS = [
  {
    name: '(home)',
    route: '/(tabs)/(home)' as const,
    icon: 'menu-book' as const,
    label: 'Grammar',
  },
  {
    name: 'chat',
    route: '/(tabs)/chat' as const,
    icon: 'chat-bubble-outline' as const,
    label: 'Chat',
  },
  {
    name: 'vocabulary',
    route: '/(tabs)/vocabulary' as const,
    icon: 'layers' as const,
    label: 'Vocab',
  },
];

export default function TabLayoutIOS() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="(home)" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="vocabulary" />
      </Stack>
      <FloatingTabBar tabs={TABS} containerWidth={300} />
    </View>
  );
}
