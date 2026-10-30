import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { usePromptStore } from '../store/prompt';
import { C, ui } from '../lib/theme';

/** Renders whatever ask()/choose() is waiting for. Mounted once in the tabs layout. */
export default function PromptHost() {
  const current = usePromptStore(s => s.current);
  const close = usePromptStore(s => s.close);
  const [value, setValue] = useState('');
  // Keep the dialog mounted between questions: on iOS a modal that closes and
  // reopens in the same moment (ask → ask) can silently fail to appear.
  const last = useRef(current);
  if (current) last.current = current;
  useEffect(() => { setValue(current?.defaultValue ?? ''); }, [current]); // also clears a typed password on close
  const shown = current || last.current;
  if (!shown) return null;

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => close(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: C.sheet, borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: C.border }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{shown.title}</Text>
          {shown.message ? <Text style={[ui.muted, { marginTop: 6, fontSize: 13 }]}>{shown.message}</Text> : null}

          {shown.choices ? (
            <View style={{ gap: 8, marginTop: 14 }}>
              {shown.choices.map(c => (
                <TouchableOpacity key={c.value} style={ui.ghost} onPress={() => close(c.value)} accessibilityRole="button">
                  <Text style={ui.ghostText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => close(null)} style={{ padding: 10, alignItems: 'center' }}>
                <Text style={[ui.muted, { fontSize: 14 }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={[ui.input, { marginTop: 14 }]}
                value={value}
                onChangeText={setValue}
                placeholder={shown.placeholder}
                placeholderTextColor="#666"
                keyboardType={shown.numeric ? 'decimal-pad' : 'default'}
                secureTextEntry={shown.secure}
                autoFocus
                onSubmitEditing={() => close(value)}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity style={[ui.ghost, { flex: 1 }]} onPress={() => close(null)}>
                  <Text style={ui.ghostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ui.btn, { flex: 2 }]} onPress={() => close(value)}>
                  <Text style={ui.btnText}>{shown.okLabel || 'OK'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
