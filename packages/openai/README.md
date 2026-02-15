# @reminix/openai

Reminix Runtime adapter for the [OpenAI API](https://platform.openai.com/docs). Serve OpenAI models as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/openai openai
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

```typescript
import OpenAI from 'openai';
import { serveAgent } from '@reminix/openai';

const client = new OpenAI();
serveAgent(client, { name: 'my-chatbot', model: 'gpt-4o' });
```

For more flexibility (e.g., serving multiple agents), use `wrapAgent` and `serve` separately:

```typescript
import OpenAI from 'openai';
import { wrapAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const client = new OpenAI();
const agent = wrapAgent(client, { name: 'my-chatbot', model: 'gpt-4o' });
serve({ agents: [agent] });
```

Your agent is now available at:
- `POST /agents/my-chatbot/invoke` - Execute the agent

## API Reference

### `serveAgent(client, options)`

Wrap an OpenAI client and serve it immediately. Combines `wrapAgent` and `serve` for single-agent setups.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `OpenAI` | required | An OpenAI client |
| `options.name` | `string` | `"openai-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gpt-4o-mini"` | Model to use for completions |
| `options.port` | `number` | `8080` | Port to serve on |
| `options.hostname` | `string` | `"0.0.0.0"` | Hostname to bind to |

### `wrapAgent(client, options)`

Wrap an OpenAI client for use with Reminix Runtime. Use this with `serve` from `@reminix/runtime` for multi-agent setups.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `OpenAI` | required | An OpenAI client |
| `options.name` | `string` | `"openai-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gpt-4o-mini"` | Model to use for completions |

**Returns:** `OpenAIAgentAdapter` - A Reminix adapter instance

### Example with Custom Configuration

```typescript
import OpenAI from 'openai';
import { wrapAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const client = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'https://your-proxy.com/v1', // Optional: custom endpoint
});

const agent = wrapAgent(client, {
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
