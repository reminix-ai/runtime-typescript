# @reminix/anthropic

Reminix Runtime adapter for the [Anthropic API](https://docs.anthropic.com/). Deploy Claude models as a REST API.

## Installation

```bash
npm install @reminix/runtime @reminix/anthropic @anthropic-ai/sdk
```

## Quick Start

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { wrap } from '@reminix/anthropic';
import { serve } from '@reminix/runtime';

// Create an Anthropic client
const client = new Anthropic();

// Wrap it with the Reminix adapter
const agent = wrap(client, { name: 'my-claude', model: 'claude-sonnet-4-20250514' });

// Serve it as a REST API
serve([agent], { port: 8080 });
```

Your agent is now available at:
- `POST /my-claude/invoke` - Single-turn invocation
- `POST /my-claude/chat` - Multi-turn chat

## API Reference

### `wrap(client, options)`

Wrap an Anthropic client for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `Anthropic` | required | An Anthropic client |
| `options.name` | `string` | `"anthropic-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"claude-sonnet-4-20250514"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |

**Returns:** `AnthropicAdapter` - A Reminix adapter instance

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

## Runtime Documentation

For information about the server, endpoints, request/response formats, and more, see the [`@reminix/runtime`](https://www.npmjs.com/package/@reminix/runtime) package.

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [Anthropic Documentation](https://docs.anthropic.com/)

## License

Apache-2.0
