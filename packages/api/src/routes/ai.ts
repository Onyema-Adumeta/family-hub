import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { AuthRequest } from '../middleware/auth';
import { aiAllowed, AI_OFF_MESSAGE } from '../services/aiPrivacy';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'missing' });

// The instructions are fixed on the server. A "system" value sent by the app is
// ignored, so nobody can re-program the assistant that children talk to.
const SYSTEM = 'You are a helpful, friendly family assistant. Keep responses concise, warm and practical. '
  + 'Everything you say must be appropriate for children. Do not ask for or repeat personal details '
  + 'such as full names, addresses, schools, birthdays or phone numbers.';

const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

router.post('/chat', async (req: AuthRequest, res) => {
  if (!(await aiAllowed(req.familyId!))) return res.status(403).json({ error: AI_OFF_MESSAGE });
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Send between 1 and 20 messages' });
  }
  const clean = [];
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim() || m.content.length > MAX_CHARS) {
      return res.status(400).json({ error: 'Invalid message' });
    }
    clean.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }
  if (clean[clean.length - 1].role !== 'user') return res.status(400).json({ error: 'The last message must be from you' });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM,
      messages: clean,
    });
    const block = response.content[0] as any;
    res.json({ text: block?.type === 'text' ? block.text : '' });
  } catch (e) {
    // Details go to the server log only; the app gets a plain message (Muse D16).
    console.error('AI chat error:', e);
    res.status(502).json({ error: 'The assistant is unavailable right now. Please try again later.' });
  }
});

export default router;
