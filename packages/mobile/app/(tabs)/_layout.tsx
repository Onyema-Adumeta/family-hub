// app/(tabs)/_layout.tsx
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
      {/* â”€â”€ Visible tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="ðŸ " focused={focused} /> }}
      />
      <Tabs.Screen
        name="chores"
        options={{ title: 'Chores', tabBarIcon: ({ focused }) => <TabIcon emoji="âœ…" focused={focused} /> }}
      />
      <Tabs.Screen
        name="rewards"
        options={{ title: 'Rewards', tabBarIcon: ({ focused }) => <TabIcon emoji="â­" focused={focused} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="ðŸ’¬" focused={focused} /> }}
      />
      <Tabs.Screen
        name="meals"
        options={{ title: 'Meals', tabBarIcon: ({ focused }) => <TabIcon emoji="ðŸ½ï¸" focused={focused} /> 
      <Tabs.Screen
        name="lists"
        options={{ title: "Lists", tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} /> }}
      />
}}
      />

      {/* â”€â”€ Hidden screens (navigable via router.push, no tab icon) â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Tabs.Screen
        name="schedule"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="quests"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="trivia"
        options={{ href: null }}
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
