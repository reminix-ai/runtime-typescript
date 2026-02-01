# @reminix/runtime

The open source runtime for serving AI agents via REST APIs. Part of [Reminix](https://reminix.com) — the developer platform for AI agents.

Core runtime package for serving AI agents and tools via REST APIs. Provides the `agent()` and `tool()` factory functions, agent templates (prompt, chat, task, rag, thread), and types `Message` and `ToolCall` for OpenAI-style conversations.

Built on [Hono](https://hono.dev) for portability across Node.js, Deno, Bun, and edge runtimes.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/runtime
```

## Quick Start

```typescript
import { agent, serve } from '@reminix/runtime';

// Create an agent for task-oriented operations
const calculator = agent('calculator', {
  description: 'Add two numbers',
  input: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  },
  handler: async ({ a, b }) => (a as number) + (b as number),
});

// Serve the agent
serve({ agents: [calculator], port: 8080 });
```

## How It Works

The runtime creates a REST server (powered by [Hono](https://hono.dev)) with the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/info` | GET | Runtime discovery (version, agents, tools) |
| `/agents/{name}/invoke` | POST | Invoke an agent |
| `/tools/{name}/call` | POST | Call a tool |

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
    "version": "0.0.17",
    "language": "typescript",
    "framework": "hono"
  },
  "agents": [
    {
      "name": "calculator",
      "type": "agent",
      "description": "Add two numbers",
      "input": {
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
    }
  ],
  "tools": [
    {
      "name": "get_weather",
      "type": "tool",
      "description": "Get current weather for a location",
      "input": { ... },
      "output": { ... }
    }
  ]
}
```

### Agent Invoke Endpoint

`POST /agents/{name}/invoke` - Invoke an agent.

Request keys are defined by the agent's input schema. For example, a calculator agent with input schema `{ properties: { a, b } }` expects `a` and `b` at the top level:

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

Chat agents (template `chat` or `thread`) expect `messages` at the top level. Messages are OpenAI-style: `role` (`user` | `assistant` | `system` | `tool`), `content`, and optionally `tool_calls`, `tool_call_id`, and `name`. Use the `Message` and `ToolCall` types from `@reminix/runtime` in your handler. Chat returns a string; thread returns an array of messages.

```bash
curl -X POST http://localhost:8080/agents/assistant/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**Response (chat):**
```json
{
  "content": "You said: Hello!"
}
```

### Tool Call Endpoint

`POST /tools/{name}/call` - Call a standalone tool.

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

### Agent templates

You can use a **template** to get standard input/output schemas without defining them yourself. Pass `template` when creating an agent:

| Template | Input | Output | Use case |
|----------|--------|--------|----------|
| `prompt` (default) | `{ prompt: string }` | `string` | Single prompt in, text out |
| `chat` | `{ messages: Message[] }` | `string` | Multi-turn chat, final reply as string |
| `task` | `{ task: string, ... }` | JSON | Task name + params, structured result |
| `rag` | `{ query: string, messages?: Message[], collectionIds?: string[] }` | `string` | RAG query, optional history and collections |
| `thread` | `{ messages: Message[] }` | `Message[]` | Multi-turn with tool calls; returns updated thread |

Messages are OpenAI-style: `role`, `content`, and optionally `tool_calls`, `tool_call_id`, and `name`. Use the exported types `Message` and `ToolCall` from `@reminix/runtime` for type-safe handlers.

```typescript
import { agent, serve, type Message, type ToolCall } from '@reminix/runtime';

const assistant = agent('assistant', {
  template: 'chat',
  description: 'Helpful assistant',
  handler: async ({ messages }) => {
    const last = (messages as Message[]).slice(-1)[0];
    return last?.role === 'user' ? `You said: ${last.content}` : 'Hello!';
  },
});

serve({ agents: [assistant], port: 8080 });
```

### Task-Oriented Agent

Use `agent()` for task-oriented agents that take structured input and return output (or omit `template` / use `template: 'prompt'` or `template: 'task'` for standard shapes):

```typescript
import { agent, serve } from '@reminix/runtime';

const calculator = agent('calculator', {
  description: 'Add two numbers',
  input: {
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
  input: {
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

### Streaming

Agents support streaming via async generators. When you use an async generator function, the agent automatically supports streaming:

```typescript
import { agent, serve } from '@reminix/runtime';

const streamer = agent('streamer', {
  description: 'Stream text word by word',
  input: {
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

serve({ agents: [streamer], port: 8080 });
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
  input: {
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
  input: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  handler: async ({ text }) => (text as string).slice(0, 100) + '...',
});

const calculator = tool('calculate', {
  description: 'Perform basic math operations',
  input: {
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

Factory function to create an agent. Use `template` for standard I/O shapes, or provide custom `input`/`output` schemas.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the agent |
| `options.template` | `'prompt' \| 'chat' \| 'task' \| 'rag' \| 'thread'` | Optional. Standard input/output schema (default: `prompt` when no custom input/output). |
| `options.description` | `string` | Human-readable description |
| `options.input` | `object` | JSON Schema for input (ignored if `template` is set) |
| `options.output` | `object` | Optional JSON Schema for output (ignored if `template` is set) |
| `options.handler` | `function` | Async function or async generator |

```typescript
import { agent } from '@reminix/runtime';

// Regular agent
const myAgent = agent('my-agent', {
  description: 'Does something useful',
  input: {
    type: 'object',
    properties: { input: { type: 'string' } },
    required: ['input'],
  },
  handler: async ({ input }) => ({ result: input }),
});

// Streaming agent
const streamingAgent = agent('streaming-agent', {
  description: 'Streams output',
  input: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  handler: async function* ({ text }) {
    for (const word of (text as string).split(' ')) {
      yield word + ' ';
    }
  },
});
```

### `tool(name, options)`

Factory function to create a tool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the tool |
| `options.description` | `string` | Human-readable description |
| `options.input` | `object` | JSON Schema for input |
| `options.output` | `object` | Optional JSON Schema for output |
| `options.handler` | `function` | Async function to call when invoked |

```typescript
import { tool } from '@reminix/runtime';

const myTool = tool('my_tool', {
  description: 'Does something useful',
  input: {
    type: 'object',
    properties: { input: { type: 'string' } },
    required: ['input'],
  },
  handler: async (input) => ({ result: input.input }),
});
```

### Request/Response Types

```typescript
// Request: top-level keys based on agent's input schema
// For a calculator agent with input schema { a: number, b: number }:
interface CalculatorRequest {
  a: number;                          // Top-level key from input schema
  b: number;                          // Top-level key from input schema
  stream?: boolean;                   // Whether to stream the response
  context?: Record<string, unknown>;  // Optional metadata
}

// Response: keys based on agent's output schema
interface AgentResponse {
  content: unknown;
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
  input: {
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
