# @reminix/anthropic

Reminix Runtime adapter for the [Anthropic API](https://docs.anthropic.com/). Serve Claude models as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/anthropic @anthropic-ai/sdk
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { serveAgent } from '@reminix/anthropic';

const client = new Anthropic();
serveAgent(client, { name: 'my-claude', model: 'claude-sonnet-4-20250514', port: 8080 });
```

For more flexibility (e.g., serving multiple agents), use `wrapAgent` and `serve` separately:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { wrapAgent } from '@reminix/anthropic';
import { serve } from '@reminix/runtime';

const client = new Anthropic();
const agent = wrapAgent(client, { name: 'my-claude', model: 'claude-sonnet-4-20250514' });
serve({ agents: [agent], port: 8080 });
```

Your agent is now available at:
- `POST /agents/my-claude/invoke` - Stateless invocation
- `POST /agents/my-claude/chat` - Conversational chat

## API Reference

### `serveAgent(client, options)`

Wrap an Anthropic client and serve it immediately. Combines `wrapAgent` and `serve` for single-agent setups.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `Anthropic` | required | An Anthropic client |
| `options.name` | `string` | `"anthropic-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"claude-sonnet-4-20250514"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |
| `options.port` | `number` | `8080` | Port to serve on |
| `options.hostname` | `string` | `"0.0.0.0"` | Hostname to bind to |

### `wrapAgent(client, options)`

Wrap an Anthropic client for use with Reminix Runtime. Use this with `serve` from `@reminix/runtime` for multi-agent setups.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `Anthropic` | required | An Anthropic client |
| `options.name` | `string` | `"anthropic-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"claude-sonnet-4-20250514"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |

**Returns:** `AnthropicAgentAdapter` - A Reminix adapter instance

### System Messages

The adapter automatically handles Anthropic's system message format. System messages in your request are extracted and passed as the `system` parameter to the API.

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

Stateless invocation for task-oriented operations.

**Request:**
```json
{
  "input": {
    "prompt": "Summarize this text: ..."
  }
}
```

Or with messages:
```json
{
  "input": {
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }
}
```

**Response:**
```json
{
  "output": "Hello! How can I help you today?"
}
```

### POST /agents/{name}/chat

Conversational chat with message history.

**Request:**
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"}
  ]
}
```

**Response:**
```json
{
  "output": "The capital of France is Paris.",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."}
  ]
}
```

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
