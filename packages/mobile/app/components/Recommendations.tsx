import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { C, ui } from '../lib/theme';

// Recommendations link to web pages; these are the matching phone screens.
const SCREENS: Record<string, string> = {
  '/': '/', '/chores': '/chores', '/rewards': '/rewards', '/chat': '/chat', '/meals': '/meals',
  '/grocery': '/lists', '/schedule': '/schedule', '/quests': '/quests', '/settings': '/settings',
  '/wins': '/wins', '/bank': '/bank', '/games': '/games',
};
const screenFor = (link?: string) => (link ? SCREENS[link.startsWith('/#') ? '/' : link.split('#')[0]] : undefined);

/** Parents: the next few useful things to do, worked out from the family's data. */
export default function Recommendations({ limit = 5, title = '💡 What to do next' }: { limit?: number; title?: string }) {
  const isParent = useAuthStore(s => s.member?.role === 'parent');
  const { data = [] } = useQuery({ queryKey: ['recommendations'], queryFn: () => api.get('/insights/recommendations').then(r => r.data), enabled: isParent });
  const list = data as any[];
  if (!isParent || !list.length) return null;
  return (
    <View style={[ui.card, { borderColor: 'rgba(96,165,250,0.3)' }]}>
      <Text style={ui.cardTitle}>{title}</Text>
      {list.slice(0, limit).map((r, i) => {
        const to = screenFor(r.link);
        return (
          <View key={i} style={[ui.row, { paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }]}>
            <Text style={{ fontSize: 22 }}>{r.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[ui.text, { fontWeight: '800' }]}>{r.title}</Text>
              <Text style={ui.muted}>{r.detail}</Text>
            </View>
            {to && (
              <TouchableOpacity style={ui.ghost} onPress={() => router.push(to as any)}>
                <Text style={ui.ghostText}>Go</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}
