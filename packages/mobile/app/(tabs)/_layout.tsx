import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import ConsentGate from '../components/ConsentGate';
import PromptHost from '../components/PromptHost';
import CelebrationHost from '../components/CelebrationHost';
import { useRealtime } from '../hooks/useRealtime';
import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { registerForPush, screenFor } from '../lib/push';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  useRealtime();

  // Signed in: register this phone for notifications (asks permission the first time).
  useEffect(() => { registerForPush(true); }, []);

  // Tapping a notification opens the screen it is about.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url;
    if (lastResponse && lastResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) router.push(screenFor(url) as any);
  }, [lastResponse]);
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      // "‹ Back" on Weekly Wins, Star bank, Settings… returns to where you came from.
      backBehavior="history"
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
      {/* ── Visible tabs ── */}
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
      <Tabs.Screen
        name="lists"
        options={{ title: 'Lists', tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} /> }}
      />

      <Tabs.Screen
        name="games"
        options={{ title: 'Games', tabBarIcon: ({ focused }) => <TabIcon emoji="🎮" focused={focused} /> }}
      />

      {/* ── Hidden screens (navigable via router.push, no tab icon) ── */}
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="quests"   options={{ href: null }} />
      <Tabs.Screen name="trivia"   options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="memory"   options={{ href: null }} />
      <Tabs.Screen name="wins"     options={{ href: null }} />
      <Tabs.Screen name="bank"     options={{ href: null }} />
      <Tabs.Screen name="add-events" options={{ href: null }} />
    </Tabs>
    <ConsentGate />
    <CelebrationHost />
    <PromptHost />
    </View>
  );
}