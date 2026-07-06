import React from 'react';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { COLORS } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: '(home)',
};

export default function TabLayoutIOS() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Grammar',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name="book.fill"
              size={24}
              tintColor={color}
              resizeMode="scaleAspectFit"
              style={{ width: 24, height: 24 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name="message.fill"
              size={24}
              tintColor={color}
              resizeMode="scaleAspectFit"
              style={{ width: 24, height: 24 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Vocab',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name="rectangle.stack.fill"
              size={24}
              tintColor={color}
              resizeMode="scaleAspectFit"
              style={{ width: 24, height: 24 }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
