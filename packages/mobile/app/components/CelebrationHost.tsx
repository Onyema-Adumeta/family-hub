import { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, Animated } from 'react-native';
import { useCelebrations } from '../store/celebrations';
import { useAuthStore } from '../store/auth';
import { C, ui } from '../lib/theme';

/** Shows new badges and level-ups one at a time, for whoever earned them. */
export default function CelebrationHost() {
  const current = useCelebrations(s => s.queue[0]);
  const shift = useCelebrations(s => s.shift);
  const me = useAuthStore(s => s.member);
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!current) return;
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [current]);

  if (!current) return null;
  const mine = current.memberId === me?.id;
  const who = mine ? 'You' : current.name;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={shift}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Animated.View style={{ transform: [{ scale }], backgroundColor: C.sheet, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(251,191,36,0.4)' }}
          accessibilityLiveRegion="polite">
          <Text style={{ fontSize: 64 }}>{current.levelUp ? '🚀' : current.badges[0]?.icon || '🎉'}</Text>
          {current.levelUp && (
            <>
              <Text style={{ color: '#FBBF24', fontWeight: '900', fontSize: 13, letterSpacing: 2, marginTop: 8 }}>LEVEL UP!</Text>
              <Text style={{ color: C.text, fontWeight: '900', fontSize: 24, textAlign: 'center', marginTop: 4 }}>
                {who} reached Level {current.levelUp.level}
              </Text>
              <Text style={{ color: C.pink, fontWeight: '900', fontSize: 20 }}>{current.levelUp.title}</Text>
            </>
          )}
          {current.badges.length > 0 && (
            <View style={{ marginTop: 14, alignItems: 'center', gap: 6 }}>
              <Text style={[ui.muted, { fontSize: 13 }]}>{who} earned {current.badges.length > 1 ? 'new badges' : 'a new badge'}</Text>
              {current.badges.map(b => (
                <Text key={b.code} style={{ color: C.text, fontWeight: '800', fontSize: 17 }}>{b.icon} {b.label}</Text>
              ))}
            </View>
          )}
          <TouchableOpacity style={[ui.btn, { marginTop: 20, alignSelf: 'stretch' }]} onPress={shift} accessibilityRole="button">
            <Text style={ui.btnText}>{mine ? 'Awesome!' : 'Cheer them on 👏'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
