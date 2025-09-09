QoLA API (Express + TypeScript)

Quick start
1) Setup
```
cd /Users/denis.kolkovskiy/QOLA/apps/api
cp .env.example .env
pnpm i
```

2) Run
```
pnpm dev
```

3) Test endpoints
```
curl http://localhost:4000/health
curl -X POST http://localhost:4000/ai/token
curl -N -H "Content-Type: application/json" \
  -d '{ "seniorId":"s1","message":"hello" }' \
  http://localhost:4000/ai/chat
```

Environment
- OPENAI_API_KEY must be set for /ai/chat to call OpenAI Responses.
- OPENAI_MODEL_RESPONSES defaults to gpt-4.1-mini.


