import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="main-language" />
      <Stack.Screen name="target-language" />
      <Stack.Screen name="cefr-level" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
