# @reminix/anthropic

Reminix Runtime chat agent for the [Anthropic API](https://docs.anthropic.com/). Serve Claude models as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/anthropic @anthropic-ai/sdk
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicChatAgent } from '@reminix/anthropic';
import { serve } from '@reminix/runtime';

const client = new Anthropic();
const agent = new AnthropicChatAgent(client, { name: 'my-claude', model: 'claude-sonnet-4-20250514' });
serve({ agents: [agent] });
```

Your agent is now available at:
- `POST /agents/my-claude/invoke` - Execute the agent

## API Reference

### `new AnthropicChatAgent(client, options)`

Create an Anthropic chat agent for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `Anthropic` | required | An Anthropic client |
| `options.name` | `string` | `"anthropic-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"claude-sonnet-4-20250514"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |

**Returns:** `AnthropicChatAgent` - A Reminix chat agent instance

### System Messages

The agent automatically handles Anthropic's system message format. System messages in your request are extracted and passed as the `system` parameter to the API.

```typescript
// This works automatically:
const request = {
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello!' },
  ],
};
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
- [Anthropic Documentation](https://docs.anthropic.com/)

## License

Apache-2.0
