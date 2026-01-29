# Vercel AI Agent Example

An example showing how to serve a Vercel AI ToolLoopAgent with tool calling via Reminix Runtime.

## Setup

```bash
# From the repository root
pnpm install

# Navigate to this example
cd examples/vercel-ai-agent
```

## Environment

Create a `.env` file in the repository root with your API key:

```bash
OPENAI_API_KEY=your-api-key
```

## Usage

```bash
pnpm start
```

## Endpoints

Once running, the following endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/info` | GET | Agent discovery |
| `/agents/vercel-ai-agent/invoke` | POST | Execute agent |
| `/agents/vercel-ai-agent/invoke` | POST | Execute agent |

## Available Tools

- `getWeather(city)`: Get weather for Paris, London, Tokyo, or New York

## Testing

```bash
# Health check
curl http://localhost:8080/health

# Discovery
curl http://localhost:8080/info

# Invoke (with tool use)
curl -X POST http://localhost:8080/agents/vercel-ai-agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "What is the weather in Paris?"}}'

# Chat
curl -X POST http://localhost:8080/agents/vercel-ai-agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]}'
```

## How it works

1. Define tools using `tool` from `ai`
2. Create a Vercel AI ToolLoopAgent
3. Wrap it with `@reminix/vercel-ai`
4. Serve it with `@reminix/runtime`

```typescript
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { wrapAgent } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const getWeather = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  handler: async ({ city }) => `Weather in ${city}: Sunny, 22°C`,
});

const toolAgent = new ToolLoopAgent({
  model: openai('gpt-4o-mini'),
  tools: { getWeather },
});

const agent = wrapAgent(toolAgent, { name: 'vercel-ai-agent' });

serve({ agents: [agent], port: 8080 });
```
