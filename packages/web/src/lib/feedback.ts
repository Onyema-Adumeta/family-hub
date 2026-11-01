// "Send feedback": a quick note to the Kinroost team from any screen.
import { api } from './api';
import { choose, form } from '../store/dialog';
import { toast } from '../hooks/useApi';

export async function sendFeedback() {
  const kind = await choose('Send feedback', [
    { label: '🐞 Something isn’t working', value: 'bug' },
    { label: '💡 I have an idea', value: 'idea' },
    { label: '💬 Something else', value: 'other' },
  ], 'This goes straight to the people building Kinroost. Thank you!');
  if (!kind) return;
  const r = await form({
    title: kind === 'bug' ? 'What went wrong?' : kind === 'idea' ? 'What’s your idea?' : 'Tell us',
    message: kind === 'bug' ? 'What were you trying to do, and what happened instead?' : undefined,
    fields: [{ name: 'message', label: '', type: 'textarea', maxLength: 2000, placeholder: 'Type here…' }],
    okLabel: 'Send',
  });
  if (!r) return;
  try {
    await api.post('/feedback', { kind, message: r.message, page: location.pathname, device: 'web' });
    toast('Thanks! Your feedback was sent 💜');
  } catch (e: any) {
    toast(e?.response?.data?.error || 'Could not send feedback. Please try again.', 'error');
  }
}
