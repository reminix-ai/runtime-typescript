# @reminix/runtime

The open source runtime for serving AI agents via REST APIs. Part of [Reminix](https://reminix.com) — the developer platform for AI agents.

Core runtime package for serving AI agents and tools via REST APIs. Provides the `agent()`, `chatAgent()`, and `tool()` factory functions for building and serving AI agents.

Built on [Hono](https://hono.dev) for portability across Node.js, Deno, Bun, and edge runtimes.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/runtime
```

## Quick Start

```typescript
import { agent, chatAgent, serve } from '@reminix/runtime';

// Create an agent for task-oriented operations
const calculator = agent('calculator', {
  description: 'Add two numbers',
  parameters: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  },
  handler: async ({ a, b }) => (a as number) + (b as number),
});

// Create a chat agent for conversational interactions
const assistant = chatAgent('assistant', {
  description: 'A helpful assistant',
  handler: async (messages) => `You said: ${messages.at(-1)?.content}`,
});

// Serve the agents
serve({ agents: [calculator, assistant], port: 8080 });
```

## How It Works

The runtime creates a REST server (powered by [Hono](https://hono.dev)) with the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/info` | GET | Runtime discovery (version, agents, tools) |
| `/agents/{name}/invoke` | POST | Execute an agent |
| `/tools/{name}/call` | POST | Execute a tool |

### Health Endpoint

```bash
curl http://localhost:8080/health
```

Returns `{"status": "ok"}` if the server is running.

### Discovery Endpoint

```bash
curl http://localhost:8080/info
```

Returns runtime information, available agents, and tools:

```json
{
  "runtime": {
    "name": "reminix-runtime",
    "version": "0.0.11",
    "language": "typescript",
    "framework": "hono"
  },
  "agents": [
    {
      "name": "calculator",
      "type": "agent",
      "description": "Add two numbers",
      "parameters": {
        "type": "object",
        "properties": { "a": { "type": "number" }, "b": { "type": "number" } },
        "required": ["a", "b"]
      },
      "output": {
        "type": "object",
        "properties": { "content": { "type": "number" } },
        "required": ["content"]
      },
      "requestKeys": ["a", "b"],
      "responseKeys": ["content"],
      "streaming": false
    },
    {
      "name": "assistant",
      "type": "chat_agent",
      "description": "A helpful assistant",
      "parameters": {
        "type": "object",
        "properties": {
          "messages": {
            "type": "array",
            "items": { "type": "object", "properties": { "role": { "type": "string" }, "content": { "type": "string" } }, "required": ["role", "content"] }
          }
        },
        "required": ["messages"]
      },
      "output": {
        "type": "object",
        "properties": {
          "messages": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "role": { "type": "string" },
                "content": { "type": "string" }
              },
              "required": ["role", "content"]
            }
          }
        },
        "required": ["messages"]
      },
      "requestKeys": ["messages"],
      "responseKeys": ["messages"],
      "streaming": false
    }
  ],
  "tools": [
    {
      "name": "get_weather",
      "type": "tool",
      "description": "Get current weather for a location",
      "parameters": { ... },
      "output": { ... }
    }
  ]
}
```

### Agent Execute Endpoint

`POST /agents/{name}/invoke` - Execute an agent.

Request keys are defined by the agent's `parameters` schema. For example, a calculator agent with `parameters: { properties: { a, b } }` expects `a` and `b` at the top level:

**Task-oriented agent:**
```bash
curl -X POST http://localhost:8080/agents/calculator/invoke \
  -H "Content-Type: application/json" \
  -d '{"a": 5, "b": 3}'
```

**Response:**
```json
{
  "content": 8
}
```

**Chat agent:**

Chat agents expect `messages` at the top level and return `messages` (array):

```bash
curl -X POST http://localhost:8080/agents/assistant/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**Response:**
```json
{
  "messages": [
    {
      "role": "assistant",
      "content": "You said: Hello!"
    }
  ]
}
```

### Tool Execute Endpoint

`POST /tools/{name}/call` - Execute a standalone tool.

```bash
curl -X POST http://localhost:8080/tools/get_weather/call \
  -H "Content-Type: application/json" \
  -d '{"location": "San Francisco"}'
```

**Response:**
```json
{
  "content": { "temp": 72, "condition": "sunny" }
}
```

## Agents

Agents handle requests via the `/agents/{name}/invoke` endpoint.

### Task-Oriented Agent

Use `agent()` for task-oriented agents that take structured input and return output:

```typescript
import { agent, serve } from '@reminix/runtime';

const calculator = agent('calculator', {
  description: 'Add two numbers',
  parameters: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['a', 'b'],
  },
  handler: async ({ a, b }) => (a as number) + (b as number),
});

const textProcessor = agent('text-processor', {
  description: 'Process text in various ways',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      operation: { type: 'string', enum: ['uppercase', 'lowercase'] },
    },
    required: ['text'],
  },
  handler: async ({ text, operation }) => {
    const t = text as string;
    return operation === 'uppercase' ? t.toUpperCase() : t.toLowerCase();
  },
});

serve({ agents: [calculator, textProcessor], port: 8080 });
```

### Chat Agent

Use `chatAgent()` for conversational agents that handle message history:

```typescript
import { chatAgent, serve } from '@reminix/runtime';

const assistant = chatAgent('assistant', {
  description: 'A helpful assistant',
  handler: async (messages) => {
    const lastMsg = messages.at(-1)?.content ?? '';
    return `You said: ${lastMsg}`;
  },
});

// With context support
const contextualBot = chatAgent('contextual-bot', {
  description: 'Bot with context awareness',
  handler: async (messages, context) => {
    const userId = context?.user_id ?? 'unknown';
    return `Hello user ${userId}!`;
  },
});

serve({ agents: [assistant, contextualBot], port: 8080 });
```

### Streaming

Both factories support streaming via async generators. When you use an async generator function, the agent automatically supports streaming:

```typescript
import { agent, chatAgent, serve } from '@reminix/runtime';

// Streaming task agent
const streamer = agent('streamer', {
  description: 'Stream text word by word',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  handler: async function* ({ text }) {
    for (const word of (text as string).split(' ')) {
      yield word + ' ';
    }
  },
});

// Streaming chat agent
const streamingAssistant = chatAgent('streaming-assistant', {
  description: 'Stream responses token by token',
  handler: async function* (messages) {
    const response = `You said: ${messages.at(-1)?.content}`;
    for (const char of response) {
      yield char;
    }
  },
});

serve({ agents: [streamer, streamingAssistant], port: 8080 });
```

For streaming agents:
- `stream: true` in the request → chunks are sent via SSE
- `stream: false` in the request → chunks are collected and returned as a single response

## Tools

Tools are standalone functions served via `/tools/{name}/call`. They're useful for exposing utility functions, external API integrations, or any reusable logic.

### Creating Tools

Use the `tool()` factory function to create tools:

```typescript
import { tool, serve } from '@reminix/runtime';

const getWeather = tool('get_weather', {
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
      units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' },
    },
    required: ['location'],
  },
  output: {
    type: 'object',
    properties: {
      temp: { type: 'number' },
      condition: { type: 'string' },
    },
  },
  handler: async (input) => {
    const location = input.location as string;
    return { temp: 72, condition: 'sunny', location };
  },
});

serve({ tools: [getWeather], port: 8080 });
```

### Serving Agents and Tools Together

You can serve both agents and tools from the same runtime:

```typescript
import { agent, tool, serve } from '@reminix/runtime';

const summarizer = agent('summarizer', {
  description: 'Summarize text',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  handler: async ({ text }) => (text as string).slice(0, 100) + '...',
});

const calculator = tool('calculate', {
  description: 'Perform basic math operations',
  parameters: {
    type: 'object',
    properties: { expression: { type: 'string' } },
    required: ['expression'],
  },
  handler: async (input) => ({ result: eval(input.expression as string) }),
});

serve({ agents: [summarizer], tools: [calculator], port: 8080 });
```

## Framework Adapters

Already using a framework? Use our pre-built adapters:

| Package | Framework |
|---------|-----------|
| [`@reminix/langchain`](https://www.npmjs.com/package/@reminix/langchain) | LangChain |
| [`@reminix/langgraph`](https://www.npmjs.com/package/@reminix/langgraph) | LangGraph |
| [`@reminix/openai`](https://www.npmjs.com/package/@reminix/openai) | OpenAI |
| [`@reminix/anthropic`](https://www.npmjs.com/package/@reminix/anthropic) | Anthropic |
| [`@reminix/vercel-ai`](https://www.npmjs.com/package/@reminix/vercel-ai) | Vercel AI SDK |

## API Reference

### `serve(options)`

Start the runtime server.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options.agents` | `Agent[]` | `[]` | List of agents to serve |
| `options.tools` | `Tool[]` | `[]` | List of tools to serve |
| `options.port` | `number` | `8080` | Port to listen on. Falls back to `PORT` environment variable if not provided. |
| `options.hostname` | `string` | `"0.0.0.0"` | Host to bind to (all interfaces). Can be overridden via `HOST` env var. |

At least one agent or tool is required.

### `createApp(options)`

Create a Hono app without starting the server. Useful for testing or custom deployment.

```typescript
import { createApp } from '@reminix/runtime';

const app = createApp({ agents: [myAgent], tools: [myTool] });
// Use with any runtime: Node.js, Deno, Bun, Cloudflare Workers, etc.
```

### `agent(name, options)`

Factory function to create a task-oriented agent.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the agent |
| `options.description` | `string` | Human-readable description |
| `options.parameters` | `object` | JSON Schema for input parameters |
| `options.output` | `object` | Optional JSON Schema for output |
| `options.handler` | `function` | Async function or async generator |

```typescript
import { agent } from '@reminix/runtime';

// Regular agent
const myAgent = agent('my-agent', {
  description: 'Does something useful',
  parameters: {
    type: 'object',
    properties: { input: { type: 'string' } },
    required: ['input'],
  },
  handler: async ({ input }) => ({ result: input }),
});

// Streaming agent
const streamingAgent = agent('streaming-agent', {
  description: 'Streams output',
  parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  handler: async function* ({ text }) {
    for (const word of (text as string).split(' ')) {
      yield word + ' ';
    }
  },
});
```

### `chatAgent(name, options)`

Factory function to create a chat agent.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the agent |
| `options.description` | `string` | Human-readable description |
| `options.handler` | `function` | Async function or async generator receiving messages |

```typescript
import { chatAgent } from '@reminix/runtime';

// Regular chat agent
const bot = chatAgent('bot', {
  description: 'A simple bot',
  handler: async (messages) => `You said: ${messages.at(-1)?.content}`,
});

// With context
const contextBot = chatAgent('context-bot', {
  handler: async (messages, context) => `Hello ${context?.user_id}!`,
});

// Streaming chat agent
const streamingBot = chatAgent('streaming-bot', {
  handler: async function* (messages) {
    yield 'Hello';
    yield ' world!';
  },
});
```

### `tool(name, options)`

Factory function to create a tool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the tool |
| `options.description` | `string` | Human-readable description |
| `options.parameters` | `object` | JSON Schema for input parameters |
| `options.output` | `object` | Optional JSON Schema for output |
| `options.handler` | `function` | Async function to call when invoked |

```typescript
import { tool } from '@reminix/runtime';

const myTool = tool('my_tool', {
  description: 'Does something useful',
  parameters: {
    type: 'object',
    properties: { input: { type: 'string' } },
    required: ['input'],
  },
  handler: async (input) => ({ result: input.input }),
});
```

### Request/Response Types

```typescript
// Request: top-level keys based on agent's requestKeys (derived from parameters)
// For a calculator agent with parameters { a: number, b: number }:
interface CalculatorRequest {
  a: number;                          // Top-level key from parameters
  b: number;                          // Top-level key from parameters
  stream?: boolean;                   // Whether to stream the response
  context?: Record<string, unknown>;  // Optional metadata
}

// For a chat agent:
interface ChatRequest {
  messages: Message[];                // Top-level key (requestKeys: ['messages'])
  stream?: boolean;
  context?: Record<string, unknown>;
}

// Response: keys based on agent's responseKeys
// Regular agent (responseKeys: ['content']):
interface AgentResponse {
  content: unknown;
}

// Chat agent (responseKeys: ['messages']):
interface ChatResponse {
  messages: Array<{ role: string; content: string }>;
}
```

## Advanced

### Agent Class

For more control, you can use the `Agent` class directly:

```typescript
import { Agent, serve } from '@reminix/runtime';

const agent = new Agent('my-agent', { metadata: { version: '1.0' } });

agent.handler(async (request) => {
  return { output: 'Hello!' };
});

// Optional: streaming handler
agent.streamHandler(async function* (request) {
  yield 'Hello';
  yield ' world!';
});

serve({ agents: [agent], port: 8080 });
```

### Tool Class

For programmatic tool creation:

```typescript
import { Tool, serve } from '@reminix/runtime';

const myTool = new Tool('get_weather', {
  description: 'Get weather for a location',
  parameters: {
    type: 'object',
    properties: { location: { type: 'string' } },
    required: ['location'],
  },
  handler: async (input) => ({ temp: 72, location: input.location }),
});

serve({ tools: [myTool], port: 8080 });
```

### AgentAdapter

For building framework integrations. See the [framework adapter packages](#framework-adapters) for examples.

```typescript
import { AgentAdapter } from '@reminix/runtime';

class MyFrameworkAdapter extends AgentAdapter {
  static adapterName = 'my-framework';

  constructor(private client: MyClient, private _name = 'my-framework') {
    super();
  }

  get name() {
    return this._name;
  }

  async execute(request) {
    const result = await this.client.run(request.input);
    return { output: result };
  }
}
```

### Serverless Deployment

Use `toHandler()` for serverless deployments:

```typescript
import { agent } from '@reminix/runtime';

const myAgent = agent('my-agent', {
  handler: async ({ task }) => `Completed: ${task}`,
});

// Vercel Edge Function
export const POST = myAgent.toHandler();
export const GET = myAgent.toHandler();

// Cloudflare Workers
export default { fetch: myAgent.toHandler() };

// Deno Deploy
Deno.serve(myAgent.toHandler());

// Bun
Bun.serve({ fetch: myAgent.toHandler() });
```

## Deployment

Ready to go live?

- **[Deploy to Reminix Cloud](https://reminix.com/docs/deployment)** - Zero-config cloud hosting
- **[Self-host](https://reminix.com/docs/deployment/self-hosting)** - Run on your own infrastructure

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [Documentation](https://reminix.com/docs)

## License

Apache-2.0
