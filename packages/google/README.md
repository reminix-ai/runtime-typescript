# @reminix/google

Reminix agents for the [Google Gemini API](https://ai.google.dev/). Serve Gemini models as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/google @google/genai
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

### Chat Agent (streaming conversations)

```typescript
import { GoogleGenAI } from '@google/genai';
import { GoogleChatAgent } from '@reminix/google';
import { serve } from '@reminix/runtime';

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const agent = new GoogleChatAgent(client, { name: 'my-gemini' });
serve({ agents: [agent] });
```

### Task Agent (structured output)

```typescript
import { GoogleGenAI } from '@google/genai';
import { GoogleTaskAgent } from '@reminix/google';
import { serve } from '@reminix/runtime';

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const schema = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
    confidence: { type: 'number' },
  },
  required: ['sentiment', 'confidence'],
};
const agent = new GoogleTaskAgent(client, { outputSchema: schema, name: 'sentiment-analyzer' });
serve({ agents: [agent] });
```

### Thread Agent (tool-calling loop)

```typescript
import { GoogleGenAI } from '@google/genai';
import { GoogleThreadAgent } from '@reminix/google';
import { serve, tool } from '@reminix/runtime';
import { z } from 'zod';

const getWeather = tool('get_weather', {
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  handler: async ({ city }) => ({ temperature: 72, condition: 'sunny' }),
});

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const agent = new GoogleThreadAgent(client, { tools: [getWeather], name: 'weather-assistant' });
serve({ agents: [agent] });
```

Your agents are now available at:
- `POST /agents/{name}/invoke` - Execute the agent

## API Reference

### `new GoogleChatAgent(client, options?)`

Create a Google Gemini chat agent. Supports streaming.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `GoogleGenAI` | required | A Google GenAI client |
| `options.name` | `string` | `"google-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gemini-2.5-flash"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |
| `options.description` | `string` | `"google chat agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions merged with system messages |
| `options.tags` | `string[]` | — | Tags for categorizing/filtering agents |
| `options.metadata` | `Record<string, unknown>` | — | Custom metadata merged into agent info |

**Returns:** `GoogleChatAgent` - A Reminix chat agent instance

The chat agent:
1. Converts incoming messages to Gemini format (mapping `assistant` role to `model`)
2. Extracts system messages and merges with `instructions` as `systemInstruction`
3. Returns the model's text response
4. Supports streaming via Server-Sent Events

### `new GoogleTaskAgent(client, options)`

Create a Google Gemini task agent. Returns structured output via function calling. Does not support streaming.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `GoogleGenAI` | required | A Google GenAI client |
| `options.outputSchema` | `Record<string, unknown>` | required | JSON Schema defining the structured output |
| `options.name` | `string` | `"google-task-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gemini-2.5-flash"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |
| `options.description` | `string` | `"google task agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions passed as `systemInstruction` |
| `options.tags` | `string[]` | — | Tags for categorizing/filtering agents |
| `options.metadata` | `Record<string, unknown>` | — | Custom metadata merged into agent info |

**Returns:** `GoogleTaskAgent` - A Reminix task agent instance

The task agent:
1. Reads the `task` field from the request input
2. Includes any additional input fields as context
3. Forces a function call using `functionCallingConfig.mode = 'ANY'` with the provided `outputSchema`
4. Extracts and returns the structured result from the function call arguments

### `new GoogleThreadAgent(client, options)`

Create a Google Gemini thread agent with a tool-calling loop. Does not support streaming.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `GoogleGenAI` | required | A Google GenAI client |
| `options.tools` | `Tool[]` | required | List of tools available to the agent |
| `options.name` | `string` | `"google-thread-agent"` | Name for the agent (used in URL path) |
| `options.model` | `string` | `"gemini-2.5-flash"` | Model to use |
| `options.maxTokens` | `number` | `4096` | Maximum tokens in response |
| `options.maxTurns` | `number` | `10` | Maximum number of tool-calling turns |
| `options.description` | `string` | `"google thread agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions merged with system messages |
| `options.tags` | `string[]` | — | Tags for categorizing/filtering agents |
| `options.metadata` | `Record<string, unknown>` | — | Custom metadata merged into agent info |

**Returns:** `GoogleThreadAgent` - A Reminix thread agent instance

The thread agent:
1. Converts incoming messages to Gemini format
2. Calls the model in a loop, executing function calls each turn
3. Sends function responses back as `functionResponse` parts
4. Continues until the model produces a final response or `maxTurns` is reached
5. Returns the full conversation including tool calls and results

### System Messages

All three agents automatically handle system messages. System messages in your request are extracted and passed as `systemInstruction` in the config.

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
  "input": {
    "messages": [
      {"role": "user", "content": "What's the weather in San Francisco?"}
    ]
  }
}
```

**Response:**
```json
{
  "output": [
    {"role": "user", "content": "What's the weather in San Francisco?"},
    {"role": "assistant", "content": "", "tool_calls": [{"id": "call_get_weather_1234", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\": \"San Francisco\"}"}}]},
    {"role": "tool", "content": "{\"temperature\": 72, \"condition\": \"sunny\"}", "tool_call_id": "call_get_weather_1234"},
    {"role": "assistant", "content": "The weather in San Francisco is 72 degrees and sunny."}
  ]
}
```

### Streaming

For streaming responses (chat agent only), set `stream: true` in the request:

```json
{
  "input": {
    "prompt": "Tell me a story"
  },
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
- [Google Gemini Documentation](https://ai.google.dev/)

## License

Apache-2.0
