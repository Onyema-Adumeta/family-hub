// "Send feedback": a quick note to the Kinroost team from the phone app.
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';
import { ask, choose } from '../store/prompt';

export async function sendFeedback(page = '/settings') {
  const kind = await choose('Send feedback', [
    { label: '🐞 Something isn’t working', value: 'bug' },
    { label: '💡 I have an idea', value: 'idea' },
    { label: '💬 Something else', value: 'other' },
  ], 'This goes straight to the people building Kinroost. Thank you!');
  if (!kind) return;
  const message = await ask({
    title: kind === 'bug' ? 'What went wrong?' : kind === 'idea' ? 'What’s your idea?' : 'Tell us',
    message: kind === 'bug' ? 'What were you trying to do, and what happened instead?' : undefined,
    placeholder: 'Type here…',
    multiline: true,
    maxLength: 2000,
    okLabel: 'Send',
  });
  if (!message?.trim()) return;
  try {
    const device = `${Platform.OS} ${Constants.expoConfig?.version || ''}`.trim();
    await api.post('/feedback', { kind, message: message.trim(), page, device });
    Alert.alert('Thank you! 💜', 'Your feedback was sent.');
  } catch (e: any) {
    Alert.alert('Could not send', e?.response?.data?.error || 'Please check your connection and try again.');
  }
}
