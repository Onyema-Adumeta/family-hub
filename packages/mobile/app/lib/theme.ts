import { Linking, StyleSheet } from 'react-native';

export const C = {
  bg: '#0f0f13',
  sheet: '#1a1a24',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  text: '#f0f0f5',
  muted: 'rgba(240,240,245,0.5)',
  faint: 'rgba(240,240,245,0.35)',
  primary: '#6366F1',
  gold: '#F59E0B',
  green: '#4ADE80',
  pink: '#F472B6',
  danger: '#F87171',
};

/** The web app, for things that are easier on a big screen (data export, deleting the family, legal pages). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || 'https://family-hub-web-omega.vercel.app').replace(/\/+$/, '');
export const openWeb = (path: string) => Linking.openURL(WEB_URL + path);

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '900', color: C.text, marginBottom: 12 },
  card: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 6 },
  text: { color: C.text, fontSize: 14, fontWeight: '600' },
  muted: { color: C.muted, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ghost: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  ghostText: { color: C.text, fontWeight: '800', fontSize: 13 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12, color: C.text, fontSize: 14, fontWeight: '600' },
  back: { color: C.primary, fontWeight: '800', fontSize: 14, marginBottom: 10 },
});
