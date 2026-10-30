import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useBriefing } from '../hooks/useApi';
import { C, ui } from '../lib/theme';

/** "Good morning, Maya! 3 chores for you today, soccer at 16:00, tacos for dinner." */
export default function BriefingCard() {
  const { data } = useBriefing();
  if (!data) return null;
  return (
    <View style={[ui.card, { backgroundColor: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.25)' }]} accessibilityLabel="Today's briefing">
      <Text style={{ color: '#FBBF24', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 }}>☀️ {String(data.dayName).toUpperCase()}</Text>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', lineHeight: 22, marginTop: 6 }}>{data.summary}</Text>
      {(data.waitingForApproval > 0 || data.pendingRewards > 0) && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {data.waitingForApproval > 0 && (
            <TouchableOpacity style={ui.ghost} onPress={() => router.push('/chores')}>
              <Text style={ui.ghostText}>📸 Check {data.waitingForApproval} photo{data.waitingForApproval > 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
          {data.pendingRewards > 0 && (
            <TouchableOpacity style={ui.ghost} onPress={() => router.push('/rewards')}>
              <Text style={ui.ghostText}>🎁 {data.pendingRewards} reward request{data.pendingRewards > 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
