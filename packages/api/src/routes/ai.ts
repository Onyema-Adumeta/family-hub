import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/chat', async (req: AuthRequest, res) => {
  try {
    const { messages, system } = req.body;
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: system || 'You are a helpful family assistant. Be friendly, brief, and kid-appropriate.',
      messages
    });
    res.json({ text: (response.content[0] as any).text });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
