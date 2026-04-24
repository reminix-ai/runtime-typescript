# Starter Agent

The fastest way to get started with Reminix — a minimal agent with a single handler, no API keys, no external SDKs.

[![Deploy to Reminix](https://reminix.com/badge/deploy.svg)](https://reminix.com/new/deploy?repo=reminix-ai/runtime-typescript&folder=examples/starter-agent)

## How it works

Reminix's `agent()` factory wraps a plain async function (the `handler`) with typed `inputSchema` and `outputSchema` validation and a stable public shape. `serve()` then exposes it as a REST API with health, manifest, and invoke endpoints — no server code to write.

## What it does

```typescript
import { agent, serve } from '@reminix/runtime';
import { z } from 'zod';

const starter = agent('starter-agent', {
  description: 'A minimal starter agent',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.string(),
  handler: async ({ message }) => `You said: ${message}`,
});

serve({ agents: [starter] });
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/manifest` | GET | Agent discovery |
| `/agents/starter-agent/invoke` | POST | Execute the agent |

## Testing

```bash
curl -X POST http://localhost:8080/agents/starter-agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"message": "Hello!"}}'

# Response: {"output": "You said: Hello!"}
```

## Run locally

```bash
pnpm install
pnpm start
```
