QOLA — Project Overview, Functional Spec & Technical Blueprint

Purpose
QOLA is a mobile companion that reduces loneliness and increases safety for seniors, while giving caregivers simple oversight and peace of mind.

Primary Stack

- Mobile: React Native (Expo), TypeScript, NativeWind (Tailwind for RN), React Query, Zustand
- Backend: Node.js (TypeScript), Express, PostgreSQL + Prisma, Redis, BullMQ, WebSockets, S3-compatible storage
- AI: OpenAI (Responses API for tool-calling + Realtime API for voice), lightweight safety layer
- Comms: Expo Push, Twilio (SMS/Voice)
- DevOps: Docker, GitHub Actions, Fly.io/Render/Neon (MVP), Sentry, PostHog

1) Product Overview
1.1 Personas & Top Jobs

- Senior (voice-first, simple UI): companionship, reminders, content, one-tap help
- Caregiver (family): see “Today”, adherence, mood, get alerts, send notes
- Staff/Admin (later): multi-resident views, broadcast reminders/content

1.2 MVP Outcomes (8–10 weeks)

- Seniors complete daily check-in and follow reminders with >70% adherence
- Caregivers receive clear alerts/digests and can send a message/note
- “Talk to QOLA” voice interaction feels immediate and safe (barge-in, captions)

2) Scope — Features & Acceptance Criteria
2.1 Mobile App (React Native)

Onboarding

- Passwordless (magic link or code via SMS/Email)
- Caregiver can link to a senior via code
- A11y: large fonts, high contrast, haptics
- Done when: a new user can sign in, select role, link caregiver ↔ senior, and land on Home.

Home (“Today”)

- Next reminders (meds/events), big mic button, help button, latest caregiver note, “How are you?” check-in
- Done when: the screen shows personalized next actions and everything is tappable with large targets.

Reminders

- Create/recurring reminders, local notifications + push
- Acknowledge: “Taken”, “Skip”, “Remind later”
- SMS fallback for critical items (configurable)
- Done when: reminders fire at the right local time (time zone aware) and logs are created on ack/skip.

Companion Chat & Voice

- Text chat + voice via OpenAI Realtime API (WebRTC/WS)
- Captions (partial asr), barge-in (stop TTS mid-reply)
- Safety rules (no medical advice; escalate emergencies)
- Done when: press-to-talk responds with partial captions <500ms p95; barge-in works; safe refusals trigger correctly.

Daily Check-in

- 1–2 questions/day (mood/energy), emoji scale, short note
- Trends available to caregiver
- Done when: seniors can submit, caregivers see a sparkline or list for last 7–30 days.

Content Hub (Calming/Art Oasis)

- Short audio, image, simple video content
- Offline cache for last 24h
- Done when: content card plays locally; network loss shows cached content.

Caregiver Light Portal (web or in-app screens)

- “Today” status (adherence %, last check-in), send a note, receive alerts
- Done when: caregiver linked to a senior can see status and send a text note.

Safety / Emergency

- “I need help” button: push → SMS → optional phone call escalation
- Keyword sentinel (“chest pain”, “can’t breathe”) triggers the same
- Done when: test phrases produce a full escalation chain and audit entries.

3) System Architecture
apps/
  mobile/ (Expo RN)
  api/    (Express TS)
packages/
  ui/         (shared RN components)
  lib/ai/     (OpenAI client + prompt/tool schemas)
  lib/shared/ (types, zod schemas)
infra/
  docker, terraform (later)

API Gateway (Express): Auth, REST, SSE for chat streaming, WebSocket for audit
Services: Auth, Reminders (BullMQ), Chat (OpenAI), Content, Notifications
DB: PostgreSQL (Neon/Supabase in MVP), Prisma migrations
Cache/Queues: Redis (Upstash/Valkey)
Storage: S3 compatible (Cloudflare R2)
Observability: Sentry, PostHog

4) Data Model (Prisma sketch)
model User {
  id            String   @id @default(cuid())
  role          Role
  email         String?  @unique
  phone         String?  @unique
  createdAt     DateTime @default(now())
  profile       Profile?
  devices       Device[]
  careLinksFrom CareLink[] @relation("CaregiverLinks")
  careLinksTo   CareLink[] @relation("SeniorLinks")
}

enum Role { SENIOR CAREGIVER STAFF ADMIN }

model Profile {
  userId      String  @id
  displayName String
  birthdate   DateTime?
  locale      String?
  a11yPrefs   Json?
  emergency   Json?
  User        User     @relation(fields: [userId], references: [id])
}

model CareLink {
  id          String   @id @default(cuid())
  seniorId    String
  caregiverId String
  status      LinkStatus @default(PENDING)
  createdAt   DateTime @default(now())
  Senior      User     @relation("SeniorLinks", fields: [seniorId], references: [id])
  Caregiver   User     @relation("CaregiverLinks", fields: [caregiverId], references: [id])
}
enum LinkStatus { PENDING ACTIVE REVOKED }

model Reminder {
  id          String   @id @default(cuid())
  seniorId    String
  type        ReminderType
  title       String
  tz          String
  schedule    String
  meta        Json?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  Senior      User     @relation(fields: [seniorId], references: [id])
}
enum ReminderType { MEDICATION EVENT CHECKIN CUSTOM }

model ReminderLog {
  id         String   @id @default(cuid())
  reminderId String
  at         DateTime @default(now())
  status     LogStatus
  note       String?
  Reminder   Reminder @relation(fields: [reminderId], references: [id])
}
enum LogStatus { TAKEN SKIPPED SNOOZE MISSED }

model Checkin {
  id       String   @id @default(cuid())
  seniorId String
  date     DateTime @default(now())
  mood     Int?
  energy   Int?
  note     String?
  Senior   User     @relation(fields: [seniorId], references: [id])
}

model ContentItem {
  id        String   @id @default(cuid())
  kind      String
  title     String
  url       String
  duration  Int?
  tags      String[]
  audience  String?
  createdAt DateTime @default(now())
}

model Message {
  id        String   @id @default(cuid())
  fromUser  String
  toUser    String
  channel   String
  body      String
  meta      Json?
  createdAt DateTime @default(now())
}

model Device {
  id            String  @id @default(cuid())
  userId        String
  expoPushToken String?
  platform      String?
  User          User    @relation(fields: [userId], references: [id])
}

model AiSession {
  id        String   @id @default(cuid())
  seniorId  String
  startedAt DateTime @default(now())
  summary   String?
  safety    Json?
}

model Audit {
  id       String   @id @default(cuid())
  actorId  String?
  action   String
  entity   String?
  entityId String?
  extra    Json?
  createdAt DateTime @default(now())
}

5) API Contract (REST + SSE + WS)
Auth

- POST /auth/magic-link { email|phone }
- POST /auth/verify { token } → { accessToken, refreshToken, role }
- GET /me → { user, profile }
- PATCH /me → update profile & prefs

Care Links

- POST /care-links { seniorCode } → { status }
- GET /care-links → list
- POST /care-links/:id/accept → { status: "ACTIVE" }

Reminders

- POST /seniors/:id/reminders { type,title, tz, schedule, meta }
- GET /seniors/:id/reminders
- POST /reminders/:id/ack { status, note? }
- GET /seniors/:id/reminder-logs?from&to

Check-ins

- POST /seniors/:id/checkins { mood, energy, note? }
- GET /seniors/:id/checkins?range=7d|30d

Content

- GET /content?tags=calming,daily&limit=10
- (admin) POST /content seed items

Messaging

- POST /messages { toUser, body }
- GET /messages?peer=<id>
- (webhook) POST /hooks/sms-inbound (Twilio)

Emergency

- POST /emergency { seniorId, reason }
- GET /emergencies/:id

AI (OpenAI)

- POST /chat (SSE stream): { seniorId, message }
- POST /ai/token?mode=realtime → { token, expires_at }
- WS /ai/observe (optional; internal)

6) OpenAI Integration (Responses + Realtime)
Model Routing

- Text/chat: Responses API with tool calling
- Voice: Realtime API (WebRTC preferred; WS fallback) for ASR + TTS

Tool (function) Specs (JSON Schema)

- createReminder({ seniorId, title, type, schedule, tz, meta? })
- listToday({ seniorId })
- sendCaregiverNote({ seniorId, text, priority })
- triggerEmergency({ seniorId, reason })
- getCalmingContent({ tags, limit })

Safety & Prompts

- System prompt (senior): empathetic, concise, no medical advice, escalate emergencies, locale-aware
- Moderation: provider moderation + keyword sentinels
- PII minimization: don’t pass phone/email to prompts

Latency & Cost Controls

- Stream tokens via SSE; cap output tokens by route
- Use smaller model for tool-only intents; larger for summaries
- Realtime first partial caption < 500ms p95; text first token < 1.5s p95

7) Mobile App Structure (Expo + NativeWind)
apps/mobile/
  app/
    (auth)/signin.tsx
    (tabs)/index.tsx
    chat.tsx
    reminders.tsx
    content.tsx
    family.tsx
    modals/CheckIn.tsx
    modals/Emergency.tsx
  state/
  api/
  ui/
  voice/
  utils/

8) Backend Structure (Express + Prisma)
apps/api/
  src/
    index.ts
    config/env.ts
    auth/{controller,service}.ts
    users/{controller,service}.ts
    reminders/{controller,service,queue}.ts
    checkins/{controller,service}.ts
    content/{controller,service}.ts
    messages/{controller,service,webhooks}.ts
    ai/{responses,tools,realtime,guardrails}.ts
    notifications/{push,sms,voice}.ts
    middleware/{auth,rateLimit,error}.ts
    lib/{prisma,redis,logger}.ts

Queues: BullMQ jobs: scheduleReminder, sendDigest, smsFallback.
Notifications: Expo Push, Twilio SMS/Voice.

9) Environment & Secrets

Server

DATABASE_URL=postgres://...
REDIS_URL=redis://...
JWT_SECRET=...
OPENAI_API_KEY=...
OPENAI_MODEL_RESPONSES=gpt-4.1-mini
OPENAI_MODEL_REALTIME=gpt-4o-realtime
EXPO_ACCESS_TOKEN=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_NUMBER=+1...
PUSH_EXPO_USE_SANDBOX=true

Mobile

No OpenAI keys client-side. Only call POST /ai/token for ephemeral Realtime token.

10) Example Endpoints (abridged)

/chat (Responses API + tool calling; SSE stream)

app.post('/chat', authAny(['SENIOR','CAREGIVER']), async (req, res) => {
  const { seniorId, message } = ChatSchema.parse(req.body);
  const ctx = await loadChatContext(seniorId);
  const tools = getToolSpecs();

  const stream = await openai.responses.stream({
    model: process.env.OPENAI_MODEL_RESPONSES!,
    input: [
      { role: "system", content: buildSeniorSystemPrompt(seniorId) },
      ...ctx,
      { role: "user", content: message }
    ],
    tools
  });

  res.setHeader('Content-Type', 'text/event-stream');
  for await (const event of stream) {
    res.write(`event: chunk\ndata: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
});

/ai/token (mint ephemeral token for OpenAI Realtime)

app.post('/ai/token', auth('SENIOR'), async (req, res) => {
  const token = await mintRealtimeToken({ 
    model: process.env.OPENAI_MODEL_REALTIME!, 
    ttlSeconds: 60 
  });
  res.json({ token, expires_at: Date.now() + 60_000 });
});

Reminder scheduler (BullMQ)

queue.process('scheduleReminder', async (job) => {
  const r = await prisma.reminder.findUnique({ where: { id: job.data.reminderId }});
  if (!r?.active) return;
  await sendPushAndLocal(r);
  await prisma.reminderLog.create({ data: { reminderId: r.id, status: 'MISSED' }});
});

11) Analytics & KPIs

- Events: app_open, chat_message, voice_session, reminder_ack, checkin_submit, emergency_trigger, caregiver_note
- KPIs: WAU seniors, reminder adherence %, daily check-in rate, avg session length, caregiver response time, emergency false-positive rate, churn
- Reports: weekly digest (BullMQ → email/Slack), per-feature dashboard in PostHog

12) Testing Strategy

- Unit: vitest/jest for services & UI components
- API: supertest + zod validation snapshots
- E2E (mobile): Detox smoke flows (Onboarding → Reminder ack → Voice session → Emergency test)
- Safety tests: curated phrase pack (emergency, meds, self-harm, confusion)
- Resilience: offline mode, network drops, SMS fallback

13) Security, Privacy, Compliance

- RBAC: SENIOR/CAREGIVER/STAFF/ADMIN on endpoints and tool execution
- PII minimization: never send phone/email to OpenAI; redact prompts in audit logs (hash templates + variable keys)
- Consent: explicit for caregiver link & emergency contacts
- Data retention: AI sessions & logs 90 days (MVP), export/delete endpoints
- Transport: TLS everywhere; JWT short-lived + refresh; rotating secrets (Doppler/SOPS)

14) Milestones & Tickets (Jira-ready)

M1 — Foundations (Week 1–2)
- Repos, CI, Sentry/PostHog, Prisma schema v1, /auth/*, /me, Expo app shell, NativeWind theme

M2 — Reminders + Content (Week 3–4)
- CRUD + schedules (BullMQ), local/push/SMS, logs; /content feed + offline cache

M3 — Voice & Chat (Week 5–6)
- /chat SSE + tools, /ai/token + Realtime client (mic, captions, barge-in), safety middleware

M4 — Caregiver & Check-ins (Week 7)
- Check-in screens + API; caregiver “Today” + notes

M5 — Hardening & Pilot (Week 8–9)
- A11y polish, error states, perf; pilot telemetry; emergency drills; app store prep

Ticket seeds
- API: /auth/magic-link, /auth/verify, rate-limit, audit
- DB: User, Profile, CareLink, Reminder, ReminderLog, Checkin
- Service: Reminder scheduler (timezones), SMS fallback
- AI: Responses tools (createReminder, triggerEmergency, getCalmingContent), guardrails
- Mobile: MicButton + captions + barge-in, Home “Today”, Check-in modal
- Ops: secrets, cost dashboard, emergency phrase test pack

15) Developer Setup (quick start)
# Backend
cd apps/api
cp .env.example .env
pnpm i
pnpm prisma migrate dev
pnpm dev

# Mobile
cd ../mobile
pnpm i
pnpm ios   # or: pnpm android, pnpm web

If device not on same network, you can run a tunnel:
pnpm start:tunnel

API base URL is configured in apps/mobile/app.json under expo.extra.apiBaseUrl.


