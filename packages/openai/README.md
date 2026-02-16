# @reminix/openai

Reminix agents for the [OpenAI API](https://platform.openai.com/docs). Serve OpenAI models as a REST API with chat, task, and thread agents.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/openai openai
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

### Chat Agent

The chat agent follows the chat template and supports streaming responses.

```typescript
import OpenAI from 'openai';
import { OpenAIChatAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const client = new OpenAI();
const agent = new OpenAIChatAgent(client, { name: 'my-chatbot', model: 'gpt-4o' });
serve({ agents: [agent] });
```

### Task Agent

The task agent follows the task template and returns structured output. Streaming is not supported.

```typescript
import OpenAI from 'openai';
import { z } from 'zod';
import { OpenAITaskAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const summarySchema = z.object({
  title: z.string(),
  bulletPoints: z.array(z.string()),
});

const client = new OpenAI();
const agent = new OpenAITaskAgent(client, summarySchema, { name: 'summarizer', model: 'gpt-4o' });
serve({ agents: [agent] });
```

### Thread Agent

The thread agent follows the thread template and supports tool use over multiple turns. Streaming is not supported.

```typescript
import OpenAI from 'openai';
import { OpenAIThreadAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const tools = [
  {
    name: 'get_weather',
    description: 'Get the weather for a location',
    parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] },
    execute: async ({ location }: { location: string }) => `The weather in ${location} is sunny.`,
  },
];

const client = new OpenAI();
const agent = new OpenAIThreadAgent(client, tools, { name: 'assistant', model: 'gpt-4o', maxTurns: 10 });
serve({ agents: [agent] });
```

Your agents are now available at:
- `POST /agents/{name}/invoke` - Execute the agent

## API Reference

### `new OpenAIChatAgent(client, options?)`

Create an OpenAI chat agent. Follows the chat template and supports streaming.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `OpenAI` | required | An OpenAI client |
| `options.name` | `string` | `"openai-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gpt-4o-mini"` | Model to use for completions |
| `options.description` | `string` | `"openai chat agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions prepended to messages |
| `options.tags` | `string[]` | — | Tags for categorizing/filtering agents |
| `options.metadata` | `Record<string, unknown>` | — | Custom metadata merged into agent info |

**Returns:** `OpenAIChatAgent` - A Reminix chat agent instance

### `new OpenAITaskAgent(client, outputSchema, options?)`

Create an OpenAI task agent. Follows the task template and returns structured output. Streaming is not supported.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `OpenAI` | required | An OpenAI client |
| `outputSchema` | `ZodType` | required | A Zod schema defining the structured output |
| `options.name` | `string` | `"openai-task-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gpt-4o-mini"` | Model to use for completions |
| `options.description` | `string` | `"openai task agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions prepended to messages |
| `options.tags` | `string[]` | — | Tags for categorizing/filtering agents |
| `options.metadata` | `Record<string, unknown>` | — | Custom metadata merged into agent info |

**Returns:** `OpenAITaskAgent` - A Reminix task agent instance

### `new OpenAIThreadAgent(client, tools, options?)`

Create an OpenAI thread agent. Follows the thread template and supports tool use over multiple turns. Streaming is not supported.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `OpenAI` | required | An OpenAI client |
| `tools` | `Tool[]` | required | A list of tool definitions the agent can call |
| `options.name` | `string` | `"openai-thread-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gpt-4o-mini"` | Model to use for completions |
| `options.maxTurns` | `number` | `10` | Maximum number of tool-use turns before stopping |
| `options.description` | `string` | `"openai thread agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions prepended to messages |
| `options.tags` | `string[]` | — | Tags for categorizing/filtering agents |
| `options.metadata` | `Record<string, unknown>` | — | Custom metadata merged into agent info |

**Returns:** `OpenAIThreadAgent` - A Reminix thread agent instance

### Example with Custom Configuration

```typescript
import OpenAI from 'openai';
import { OpenAIChatAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const client = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'https://your-proxy.com/v1', // Optional: custom endpoint
});

const agent = new OpenAIChatAgent(client, {
  name: 'gpt4-agent',
  model: 'gpt-4o',
});

serve({ agents: [agent] });
```

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
    {"role": "system", "content": "You are a helpful assistant."},
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

For streaming responses, set `stream: true` in the request (chat agent only):

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
- [OpenAI Documentation](https://platform.openai.com/docs)

## License

Apache-2.0
