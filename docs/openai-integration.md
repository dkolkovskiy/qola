OpenAI Integration — Architecture & Spec

1) What we’ll use (and why)

- Responses API (text + tools + images) for structured, low-latency chat turns and server-side function calling.
- Realtime API (WebRTC / WebSocket) for voice conversations with live token streaming—ideal for “Talk to QOLA” and barge-in UX.
- Speech: STT via Realtime (low latency) or classic transcription as fallback; TTS from model’s audio output stream (Realtime).

Principle: One brain, two paths — Realtime for voice calls; Responses for everything else (text chat, scheduled summaries, caregiver digests). Keeps costs predictable and code paths clean.

2) End-to-end flows

A) Voice conversation (Senior ↔ QOLA; in-app push-to-talk)
1. Client requests an ephemeral session token from our API: POST /ai/token?mode=realtime.
2. Backend mints a short-lived OpenAI Realtime session and returns the token.
3. Client opens WebRTC (preferred) or WS to OpenAI Realtime with that token; sends microphone audio; receives streaming text + audio back; shows partial captions and plays TTS.
4. Server tap (optional): mirror events to our server over a control WS for auditing (utterances, safety flags) before persisting to ai_sessions + audit.

B) Text chat (Senior/Caregiver ↔ QOLA)
1. Client → API: POST /chat with message + senior_id.
2. API → OpenAI Responses: send prior turns, persona system prompt, and tool specs (reminder create/read, content fetch, emergency escalation).
3. OpenAI → API: streamed text tokens + tool calls.
4. API executes tools and returns final reply (+ optional tts_url if we synthesize) to client.

C) Daily digests / summaries (server-side)
Cron (BullMQ) → Responses API with a prompt template → write result to caregiver feed & email/SMS as needed.

3) Backend interfaces (Node.js, TypeScript)

REST & WS surface
- POST /ai/token → { token, expires_at } // Realtime ephemeral capability
- POST /chat → { reply, tool_results[], safety } // Responses API orchestration
- WS /ai/observe → mirror of Realtime events for audit (optional, behind auth)

Tool (function) contracts exposed to the model
- createReminder({ seniorId, title, schedule, type, tz }) → { reminderId }
- listToday({ seniorId }) → { reminders[], appointments[] }
- sendCaregiverNote({ seniorId, text, priority }) → { messageId }
- triggerEmergency({ seniorId, reason }) → { incidentId }
- getCalmingContent({ tags[], limit }) → { items[] }

4) Prompts & safety

System prompts (snapshots)
- Companion (senior): empathetic, short sentences, no medical advice, escalate emergencies, respect accessibility & locale.
- Caregiver: concise status, calls to action.

Guardrails
- Prepend content policy instructions + refusal patterns; use provider moderation; add keyword sentinels (e.g., chest pain → escalate). We enforce server-side checks before executing risky tools.

Memory & privacy
- Ephemeral conversational memory in Redis with TTL (e.g., 24h) for small context.
- Long-term facts in profiles under explicit consent (opt-in only).
- PHI-avoidant: do not store diagnoses in prompts or state.

5) React Native client integration

Voice (Realtime)
- WebRTC shim to send PCM/Opus microphone frames → OpenAI Realtime; play returned audio stream; render partial captions; barge-in.
- Offline fallback: disable mic, route to text chat with local notice.

Text (Responses)
- useMutation to /chat with SSE streaming for token UI; show partial tokens; allow “copy to reminder”.

6) Configuration & secrets

Env (server)
- OPENAI_API_KEY, OPENAI_ORG, OPENAI_PROJECT
- OPENAI_MODEL_RESPONSES (e.g., gpt-4.1-mini)
- OPENAI_MODEL_REALTIME (e.g., gpt-4o-realtime)
- OPENAI_SAFE_MODE=standard|strict

Env (mobile)
- None for OpenAI; only request QOLA tokens from server.

7) Cost, latency, resilience

Latency
- Realtime (WebRTC) for sub-second back-channel; text uses SSE for immediate token paint.

Cost controls
- Cap max output tokens per route; model tiering by task complexity; drop images unless needed.

Retries & fallbacks
- Realtime → fallback to /chat + local TTS; Responses timeout → templated replies + human escalation.

Observability
- Log model, tokens in/out, latency, tool usage; weekly cost digest.

8) Security & compliance

- Token minting: server-side short-lived Realtime tokens (1–2 min) scoped to senior session.
- PII minimization; RBAC on tool execution; audit compact traces (prompt hash + redacted variables + tool calls + safety flags).
- Data controls: follow OpenAI account data usage settings; document in DPA.

9) Example server code (TypeScript, Express) — abridged

// POST /chat — stream via Responses API
app.post('/chat', authAny(['senior','caregiver']), async (req, res) => {
  const { seniorId, message } = zodParse(ChatSchema, req.body);
  const context = await buildContext(seniorId);
  const tools = getToolSpecs();

  const resp = await openai.responses.create({
    model: process.env.OPENAI_MODEL_RESPONSES!,
    input: [
      { role: "system", content: systemPromptFor(seniorId) },
      ...context,
      { role: "user", content: message },
    ],
    tools,
    stream: true
  });
  pipeStream(resp, res);
});

// POST /ai/token — ephemeral token for Realtime
app.post('/ai/token', auth('senior'), async (req, res) => {
  const token = await mintRealtimeToken({
    model: process.env.OPENAI_MODEL_REALTIME!,
  });
  res.json({ token, expires_at: Date.now() + 60_000 });
});

10) Acceptance criteria (MVP)

Voice
- Press mic → ASR begins < 500ms; partial captions appear while speaking; barge-in cancels TTS; 95%+ sessions complete without fallback.

Text
- /chat streams first token ≤ 1.5s p95; tool calls create reminders correctly with timezone.

Safety
- “I have chest pain” → immediate triggerEmergency tool; caregiver alerted (push + SMS).
- Medication dosing questions → refusal + “contact caregiver/doctor” template.

Privacy
- No raw PII in prompts; audit logs show redacted variables.

Cost
- Average output tokens/message under configured target; weekly report emailed to ops.

11) Tickets (Jira-ready)

Backend: /chat SSE + tool router; /ai/token; tool executors; guardrails middleware; audit & cost metrics.
Mobile: VoiceScreen (WebRTC Realtime); ChatScreen streaming; settings for voice speed/auto-read/high-contrast captions; offline routing.
Ops: Secrets management; model routing config; weekly cost digest; QA scripts for emergency phrases/meds/self-harm/confusion.


