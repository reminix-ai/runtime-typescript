# @reminix/vercel-ai

Reminix Runtime chat agent for the [Vercel AI SDK](https://ai-sdk.dev). Serve AI agents as a REST API.

Supports both:

- **ToolLoopAgent** - Full agents with tools and automatic tool loop handling
- **Model** - Simple completions via `generateText`/`streamText` without tools

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/vercel-ai ai @ai-sdk/openai
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start with Model

```typescript
import { openai } from '@ai-sdk/openai';
import { VercelAIChat } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const model = openai('gpt-4o');
const agent = new VercelAIChat(model, { name: 'chat-agent' });
serve({ agents: [agent] });
```

## Quick Start with ToolLoopAgent

For agents with tools, use `ToolLoopAgent`:

```typescript
import { ToolLoopAgent, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { VercelAIChat } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const weatherTool = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({
    city: z.string()
  }),
  execute: async ({ city }) => {
    return { city, temp: 72, condition: 'sunny' };
  }
});

const toolAgent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  instructions: 'You help users check the weather.',
  tools: { getWeather: weatherTool }
});

const agent = new VercelAIChat(toolAgent, { name: 'weather-agent' });
serve({ agents: [agent] });
```

Your agent is now available at:
- `POST /agents/<name>/invoke` - Execute the agent

## API Reference

### `new VercelAIChat(modelOrAgent, options)`

Create a Vercel AI chat agent for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `modelOrAgent` | `ToolLoopAgent \| LanguageModel` | required | A ToolLoopAgent or language model |
| `options.name` | `string` | `"vercel-ai-agent"` | Name for the agent (used in URL path) |

**Returns:** `VercelAIChat` - A Reminix chat agent instance

## Using Different Providers

The Vercel AI SDK supports multiple providers:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { VercelAIChat } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const gpt = new VercelAIChat(openai('gpt-4o'), { name: 'gpt' });
const claude = new VercelAIChat(anthropic('claude-sonnet-4-20250514'), { name: 'claude' });
const gemini = new VercelAIChat(google('gemini-pro'), { name: 'gemini' });

serve({ agents: [gpt, claude, gemini] });
```

## When to Use Each Option

| Option | Use Case |
|--------|----------|
| **ToolLoopAgent** | Agents that need tools, multi-step reasoning, automatic tool loop |
| **Model** | Simple completions, providers without dedicated adapters (Google, Mistral, etc.) |

## Endpoint Input/Output Formats

### POST /agents/{name}/invoke

Execute the agent with a prompt or messages.

**Request with prompt:**
```json
{
  "prompt": "Summarize this text: ..."
}
```

**Request with messages:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
}
```

**Response:**
```json
{
  "output": "Hello! How can I help you today?"
}
```

### Streaming

For streaming responses, set `stream: true` in the request:

```json
{
  "prompt": "Tell me a story",
  "stream": true
}
```

The response will be sent as Server-Sent Events (SSE).

## Runtime Documentation

For information about the server, endpoints, request/response formats, and more, see the [`@reminix/runtime`](https://www.npmjs.com/package/@reminix/runtime) package.

## Deployment

Ready to go live?

- **[Deploy to Reminix Cloud](https://reminix.com/docs/deployment)** - Zero-config cloud hosting
- **[Self-host](https://reminix.com/docs/deployment/self-hosting)** - Run on your own infrastructure

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [Vercel AI SDK Documentation](https://ai-sdk.dev)

## License

Apache-2.0
