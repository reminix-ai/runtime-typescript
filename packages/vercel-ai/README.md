# @reminix/vercel-ai

Reminix agents for the [Vercel AI SDK](https://ai-sdk.dev). Serve AI agents as a REST API.

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
import { VercelAIChatAgent } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const model = openai('gpt-4o');
const agent = new VercelAIChatAgent(model, { name: 'chat-agent' });
serve({ agents: [agent] });
```

## Quick Start with ToolLoopAgent

For agents with tools, use `ToolLoopAgent`:

```typescript
import { ToolLoopAgent, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { VercelAIChatAgent } from '@reminix/vercel-ai';
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

const agent = new VercelAIChatAgent(toolAgent, { name: 'weather-agent' });
serve({ agents: [agent] });
```

## Quick Start with VercelAIThreadAgent

For agents that need a full thread of messages (including tool call and tool result messages) in their output, use `VercelAIThreadAgent`. It accepts a `LanguageModel` and an array of Reminix `Tool` objects, and runs the Vercel AI SDK tool loop via `generateText` with `stopWhen`:

```typescript
import { openai } from '@ai-sdk/openai';
import { VercelAIThreadAgent } from '@reminix/vercel-ai';
import { tool, serve } from '@reminix/runtime';
import { z } from 'zod';

const getWeather = tool('getWeather', {
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  handler: async ({ city }) => ({ city, temp: 72, condition: 'sunny' }),
});

const agent = new VercelAIThreadAgent(openai('gpt-4o'), {
  tools: [getWeather],
  name: 'weather-thread',
  maxTurns: 5,
});

serve({ agents: [agent] });
```

Your agent is now available at:
- `POST /agents/{name}/invoke` - Execute the agent

## API Reference

### `new VercelAIChatAgent(modelOrAgent, options)`

Create a Vercel AI chat agent for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `modelOrAgent` | `ToolLoopAgent \| LanguageModel` | required | A ToolLoopAgent or language model |
| `options.name` | `string` | `"vercel-ai-agent"` | Name for the agent (used in URL path) |
| `options.description` | `string` | `"vercel ai chat agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions (used when passing a model, not a ToolLoopAgent) |
| `options.tags` | `string[]` | — | Tags for categorizing/filtering agents |
| `options.metadata` | `Record<string, unknown>` | — | Custom metadata merged into agent info |

**Returns:** `VercelAIChatAgent` - A Reminix chat agent instance

### `new VercelAIThreadAgent(model, options)`

Create a Vercel AI thread agent for use with Reminix Runtime. The thread agent returns the full message history (including tool calls and tool results) rather than a single text output.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | `LanguageModel` | required | A Vercel AI SDK language model |
| `options.tools` | `Tool[]` | required | Array of Reminix Runtime tools |
| `options.name` | `string` | `"vercel-ai-thread-agent"` | Name for the agent (used in URL path) |
| `options.maxTurns` | `number` | `10` | Maximum number of tool-loop turns |
| `options.description` | `string` | `"vercel ai thread agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions passed to `generateText` |
| `options.tags` | `string[]` | — | Tags for categorizing/filtering agents |
| `options.metadata` | `Record<string, unknown>` | — | Custom metadata merged into agent info |

**Returns:** `VercelAIThreadAgent` - A Reminix thread agent instance

## Using Different Providers

The Vercel AI SDK supports multiple providers:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { VercelAIChatAgent } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const gpt = new VercelAIChatAgent(openai('gpt-4o'), { name: 'gpt' });
const claude = new VercelAIChatAgent(anthropic('claude-sonnet-4-5-20250929'), { name: 'claude' });
const gemini = new VercelAIChatAgent(google('gemini-pro'), { name: 'gemini' });

serve({ agents: [gpt, claude, gemini] });
```

## When to Use Each Option

| Option | Use Case |
|--------|----------|
| **VercelAIChatAgent + ToolLoopAgent** | Agents that need tools, multi-step reasoning, automatic tool loop |
| **VercelAIChatAgent + Model** | Simple completions, providers without dedicated packages (Google, Mistral, etc.) |
| **VercelAIThreadAgent** | Agents that need full message history with tool calls and results in the output |

## Endpoint Input/Output Formats

### POST /agents/{name}/invoke

Execute the agent with a prompt or messages.

**Request with prompt:**
```json
{
  "input": {
    "prompt": "Summarize this text: ..."
  }
}
```

**Request with messages:**
```json
{
  "input": {
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }
}
```

**Response (VercelAIChatAgent):**
```json
{
  "output": "Hello! How can I help you today?"
}
```

**Response (VercelAIThreadAgent):**
```json
{
  "output": [
    {"role": "user", "content": "What is the weather in Paris?"},
    {"role": "assistant", "content": "", "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "getWeather", "arguments": "{\"city\":\"Paris\"}"}}]},
    {"role": "tool", "content": "{\"city\":\"Paris\",\"temp\":72,\"condition\":\"sunny\"}", "tool_call_id": "call_1"},
    {"role": "assistant", "content": "The weather in Paris is 72F and sunny."}
  ]
}
```

### Streaming

For streaming responses, set `stream: true` in the request:

```json
{
  "input": {
    "prompt": "Tell me a story"
  },
  "stream": true
}
```

The response will be sent as Server-Sent Events (SSE).

> **Note:** Streaming is supported by `VercelAIChatAgent` only. `VercelAIThreadAgent` does not support streaming.

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
