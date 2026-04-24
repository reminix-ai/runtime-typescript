# OpenAI SDK Agent

Agent using the OpenAI SDK directly. Chat completions, function calling, and streaming — no framework overhead.

[![Deploy to Reminix](https://reminix.com/badge/deploy.svg)](https://reminix.com/new/deploy?repo=reminix-ai/runtime-typescript&folder=examples/openai-agent)

## Required environment variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your [OpenAI API key](https://platform.openai.com/api-keys) |

## How it works

`OpenAIChatAgent` wraps an OpenAI SDK client so Reminix can invoke it through the uniform `Agent` interface. The adapter translates Reminix invoke requests into Chat Completions API calls and streams responses back — you get function calling, system prompts, and message history handling without writing any protocol glue.

## What it does

```typescript
import OpenAI from 'openai';
import { OpenAIChatAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const agent = new OpenAIChatAgent(new OpenAI(), {
  name: 'openai-agent',
  model: 'gpt-4o-mini',
});

serve({ agents: [agent] });
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/manifest` | GET | Agent discovery |
| `/agents/openai-agent/invoke` | POST | Execute the agent |

## Testing

```bash
# Single prompt
curl -X POST http://localhost:8080/agents/openai-agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "What is the capital of France?"}}'

# Chat-style messages
curl -X POST http://localhost:8080/agents/openai-agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"messages": [{"role": "user", "content": "Hello!"}]}}'
```

## Run locally

```bash
pnpm install
OPENAI_API_KEY=... pnpm start
```
