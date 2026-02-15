# @reminix/anthropic

Reminix Runtime agents for the [Anthropic API](https://docs.anthropic.com/). Serve Claude models as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/anthropic @anthropic-ai/sdk
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

### Chat Agent (streaming conversations)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicChatAgent } from '@reminix/anthropic';
import { serve } from '@reminix/runtime';

const client = new Anthropic();
const agent = new AnthropicChatAgent(client, { name: 'my-claude' });
serve({ agents: [agent] });
```

### Task Agent (structured output)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicTaskAgent } from '@reminix/anthropic';
import { serve } from '@reminix/runtime';

const client = new Anthropic();
const schema = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
    confidence: { type: 'number' },
  },
  required: ['sentiment', 'confidence'],
};
const agent = new AnthropicTaskAgent(client, schema, { name: 'sentiment-analyzer' });
serve({ agents: [agent] });
```

### Thread Agent (tool-calling loop)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicThreadAgent } from '@reminix/anthropic';
import { serve, tool } from '@reminix/runtime';

const getWeather = tool({
  name: 'get_weather',
  description: 'Get the current weather for a city',
  handler: async ({ city }: { city: string }) => ({ temperature: 72, condition: 'sunny' }),
});

const client = new Anthropic();
const agent = new AnthropicThreadAgent(client, [getWeather], { name: 'weather-assistant' });
serve({ agents: [agent] });
```

Your agents are now available at:
- `POST /agents/{name}/invoke` - Execute the agent

## API Reference

### `new AnthropicChatAgent(client, options?)`

Create an Anthropic chat agent. Supports streaming.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `Anthropic` | required | An Anthropic client |
| `options.name` | `string` | `"anthropic-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"claude-sonnet-4-20250514"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |

**Returns:** `AnthropicChatAgent` - A Reminix chat agent instance

The chat agent:
1. Converts incoming messages to Anthropic format
2. Extracts system messages and passes them as the `system` parameter
3. Returns the assistant's text response
4. Supports streaming via Server-Sent Events

### `new AnthropicTaskAgent(client, outputSchema, options?)`

Create an Anthropic task agent. Returns structured output via tool-use. Does not support streaming.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `Anthropic` | required | An Anthropic client |
| `outputSchema` | `Record<string, unknown>` | required | JSON Schema defining the structured output |
| `options.name` | `string` | `"anthropic-task-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"claude-sonnet-4-20250514"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |

**Returns:** `AnthropicTaskAgent` - A Reminix task agent instance

The task agent:
1. Reads the `task` field from the request input
2. Includes any additional input fields as context
3. Forces a tool call using the provided `outputSchema`
4. Extracts and returns the structured result from the tool-use block

### `new AnthropicThreadAgent(client, tools, options?)`

Create an Anthropic thread agent with a tool-calling loop. Does not support streaming.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `Anthropic` | required | An Anthropic client |
| `tools` | `ToolLike[]` | required | List of tools available to the agent |
| `options.name` | `string` | `"anthropic-thread-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"claude-sonnet-4-20250514"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |
| `options.maxTurns` | `number` | `10` | Maximum number of tool-calling turns |

**Returns:** `AnthropicThreadAgent` - A Reminix thread agent instance

The thread agent:
1. Converts incoming messages to Anthropic format
2. Calls the model in a loop, executing tool calls each turn
3. Continues until the model produces a final response or `maxTurns` is reached
4. Returns the full conversation including tool calls and results

### System Messages

All three agents automatically handle Anthropic's system message format. System messages in your request are extracted and passed as the `system` parameter to the API.

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

### Chat Agent -- POST /agents/{name}/invoke

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

### Task Agent -- POST /agents/{name}/invoke

**Request:**
```json
{
  "input": {
    "task": "Analyze the sentiment of this review: 'Great product, love it!'"
  }
}
```

**Response:**
```json
{
  "output": {
    "sentiment": "positive",
    "confidence": 0.95
  }
}
```

### Thread Agent -- POST /agents/{name}/invoke

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "What's the weather in San Francisco?"}
  ]
}
```

**Response:**
```json
{
  "output": [
    {"role": "user", "content": "What's the weather in San Francisco?"},
    {"role": "assistant", "content": "", "tool_calls": [{"id": "toolu_01...", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\": \"San Francisco\"}"}}]},
    {"role": "tool", "content": "{\"temperature\": 72, \"condition\": \"sunny\"}", "tool_call_id": "toolu_01..."},
    {"role": "assistant", "content": "The weather in San Francisco is 72 degrees and sunny."}
  ]
}
```

### Streaming

For streaming responses (chat agent only), set `stream: true` in the request:

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
