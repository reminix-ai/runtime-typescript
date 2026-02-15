# @reminix/openai

Reminix Runtime chat agent for the [OpenAI API](https://platform.openai.com/docs). Serve OpenAI models as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/openai openai
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

```typescript
import OpenAI from 'openai';
import { OpenAIChat } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const client = new OpenAI();
const agent = new OpenAIChat(client, { name: 'my-chatbot', model: 'gpt-4o' });
serve({ agents: [agent] });
```

Your agent is now available at:
- `POST /agents/my-chatbot/invoke` - Execute the agent

## API Reference

### `new OpenAIChat(client, options)`

Create an OpenAI chat agent for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `OpenAI` | required | An OpenAI client |
| `options.name` | `string` | `"openai-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gpt-4o-mini"` | Model to use for completions |

**Returns:** `OpenAIChat` - A Reminix chat agent instance

### Example with Custom Configuration

```typescript
import OpenAI from 'openai';
import { OpenAIChat } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const client = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'https://your-proxy.com/v1', // Optional: custom endpoint
});

const agent = new OpenAIChat(client, {
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
- [OpenAI Documentation](https://platform.openai.com/docs)

## License

Apache-2.0
