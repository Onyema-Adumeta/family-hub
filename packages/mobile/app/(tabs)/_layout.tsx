// app/(tabs)/_layout.tsx
// Add schedule and quests to the tab bar, or keep them as hidden screens
// accessible via navigation from Home/Dashboard.
//
// Option A (shown here): 5-tab bar (Home, Chores, Rewards, Chat, More)
//   "More" opens a drawer/sheet — avoids cramming 7 icons into the tab bar.
//
// Option B: register schedule + quests as hidden tabs and navigate to them
//   with router.push('/(tabs)/schedule') from cards on the home screen.
//
// This file uses Option B — all screens registered, only 5 shown in the tab bar.
// The home screen links to Schedule and Quests via cards.

import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f0f13',
          borderTopColor: 'rgba(255,255,255,0.08)',
          paddingBottom: 4,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: 'rgba(240,240,245,0.5)',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '800' },
      }}
    >
      {/* ── Visible tabs ─────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="chores"
        options={{ title: 'Chores', tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} /> }}
      />
      <Tabs.Screen
        name="rewards"
        options={{ title: 'Rewards', tabBarIcon: ({ focused }) => <TabIcon emoji="⭐" focused={focused} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }}
      />
      <Tabs.Screen
        name="meals"
        options={{ title: 'Meals', tabBarIcon: ({ focused }) => <TabIcon emoji="🍽️" focused={focused} /> }}
      />

      {/* ── Hidden screens (navigable via router.push, no tab icon) ──────── */}
      <Tabs.Screen
        name="schedule"
        options={{ href: null }} // hides from tab bar
      />
      <Tabs.Screen
        name="quests"
        options={{ href: null }} // hides from tab bar
      />
      <Tabs.Screen
        name="report"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
    </Tabs>
  );
}