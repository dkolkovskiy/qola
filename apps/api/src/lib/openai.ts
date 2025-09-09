import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[openai] OPENAI_API_KEY not set — /ai/chat will not work until configured');
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const RESPONSES_MODEL = process.env.OPENAI_MODEL_RESPONSES || 'gpt-4.1-mini';


