# @reminix/openai

Reminix Runtime adapter for the [OpenAI API](https://platform.openai.com/docs). Deploy OpenAI models as a REST API.

## Installation

```bash
npm install @reminix/runtime @reminix/openai openai
```

## Quick Start

```typescript
import OpenAI from 'openai';
import { wrap } from '@reminix/openai';
import { serve } from '@reminix/runtime';

// Create an OpenAI client
const client = new OpenAI();

// Wrap it with the Reminix adapter
const agent = wrap(client, { name: 'my-chatbot', model: 'gpt-4o' });

// Serve it as a REST API
serve([agent], { port: 8080 });
```

Your agent is now available at:
- `POST /agents/my-chatbot/invoke` - Stateless invocation
- `POST /agents/my-chatbot/chat` - Conversational chat

## API Reference

### `wrap(client, options)`

Wrap an OpenAI client for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `OpenAI` | required | An OpenAI client |
| `options.name` | `string` | `"openai-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gpt-4o-mini"` | Model to use for completions |

**Returns:** `OpenAIAdapter` - A Reminix adapter instance

### Example with Custom Configuration

```typescript
import OpenAI from 'openai';
import { wrap } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const client = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'https://your-proxy.com/v1', // Optional: custom endpoint
});

const agent = wrap(client, {
  name: 'gpt4-agent',
  model: 'gpt-4o',
});

serve([agent], { port: 8080 });
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
    {"role": "user", "content": "What is the capital of France?"}
  ]
}
```

**Response:**
```json
{
  "output": "The capital of France is Paris.",
  "messages": [
    {"role": "user", "content": "What is the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."}
  ]
}
```

## Runtime Documentation

For information about the server, endpoints, request/response formats, and more, see the [`@reminix/runtime`](https://www.npmjs.com/package/@reminix/runtime) package.

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [OpenAI Documentation](https://platform.openai.com/docs)

## License

Apache-2.0
