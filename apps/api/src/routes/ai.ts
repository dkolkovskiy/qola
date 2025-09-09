import { Router } from 'express';
import { openai, RESPONSES_MODEL } from '../lib/openai';

export const router = Router();

// POST /ai/token — ephemeral token for Realtime (stub)
router.post('/token', async (_req, res) => {
  // TODO: integrate with OpenAI Realtime token minting
  const token = 'stub-token';
  const expires_at = Date.now() + 60_000;
  res.json({ token, expires_at });
});

// POST /ai/chat — SSE streaming placeholder (Responses API)
router.post('/chat', async (req, res) => {
  const { seniorId, message } = req.body || {};
  if (!seniorId || !message) {
    return res.status(400).json({ error: 'seniorId and message are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders?.();

  try {
    const stream = await openai.responses.stream({
      model: RESPONSES_MODEL,
      input: [
        { role: 'system', content: 'You are QoLA, a gentle companion. Be empathetic, concise, and never give medical advice. If emergency phrases occur (e.g., chest pain), advise seeking help.' },
        { role: 'user', content: message }
      ]
    });

    for await (const event of stream) {
      res.write(`event: chunk\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write(`event: done\n`);
    res.write(`data: {}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ message: err?.message || 'OpenAI error' })}\n\n`);
    res.end();
  }
});


