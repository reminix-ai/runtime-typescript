# Vercel AI SDK Agent

Agent built with the Vercel AI SDK. Streaming responses, tool calling, and structured output with minimal boilerplate.

[![Deploy to Reminix](https://reminix.com/badge/deploy.svg)](https://reminix.com/new/deploy?repo=reminix-ai/runtime-typescript&folder=examples/vercel-ai-agent)

## Required environment variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your [OpenAI API key](https://platform.openai.com/api-keys) |

## How it works

`VercelAIChatAgent` wraps a Vercel AI SDK `ToolLoopAgent` so it runs inside the Reminix runtime. Define your tools with `ai`'s `tool()`, plug a provider model into a `ToolLoopAgent`, and the SDK handles the tool-use loop while Reminix serves the whole thing as a streaming REST API. This example ships one `getWeather` tool to demonstrate the pattern.

## What it does

```typescript
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { VercelAIChatAgent } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const getWeather = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => `The weather in ${city} is sunny, 22°C.`,
});

const toolAgent = new ToolLoopAgent({
  model: openai('gpt-4o-mini'),
  tools: { getWeather },
});

serve({ agents: [new VercelAIChatAgent(toolAgent, { name: 'vercel-ai-agent' })] });
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/manifest` | GET | Agent discovery |
| `/agents/vercel-ai-agent/invoke` | POST | Execute the agent |

## Testing

```bash
# Tool-use question
curl -X POST http://localhost:8080/agents/vercel-ai-agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "What is the weather in Paris?"}}'

# Chat-style messages
curl -X POST http://localhost:8080/agents/vercel-ai-agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]}}'
```

## Run locally

```bash
pnpm install
OPENAI_API_KEY=... pnpm start
```
