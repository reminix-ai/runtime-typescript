# @reminix/runtime

The open source runtime for serving AI agents via REST APIs. Part of [Reminix](https://reminix.com) — the developer platform for AI agents.

Core runtime package for serving AI agents and tools via REST APIs. Provides the `agent()` and `tool()` factory functions, agent types (prompt, chat, task, rag, thread, workflow), and types `Message` and `ToolCall` for OpenAI-style conversations.

Built on [Hono](https://hono.dev) for portability across Node.js, Deno, Bun, and edge runtimes.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/runtime
```

## Quick Start

```typescript
import { z } from 'zod';
import { agent, serve } from '@reminix/runtime';

const calculator = agent('calculator', {
  description: 'Add two numbers',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  handler: async ({ a, b }) => a + b,
});

serve({ agents: [calculator] });
```

## How It Works

The runtime creates a REST server (powered by [Hono](https://hono.dev)) with the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/manifest` | GET | Runtime discovery (version, endpoints) |
| `/agents/{name}/invoke` | POST | Invoke an agent |
| `/mcp` | POST | MCP Streamable HTTP (tool discovery and execution) |

### Health Endpoint

```bash
curl http://localhost:8080/health
```

Returns `{"status": "ok"}` if the server is running.

### Discovery Endpoint

```bash
curl http://localhost:8080/manifest
```

Returns runtime information and available endpoints:

```json
{
  "runtime": {
    "name": "reminix-runtime",
    "version": "0.0.22",
    "language": "typescript"
  },
  "endpoints": [
    {
      "kind": "agent",
      "path": "/agents/calculator/invoke",
      "name": "calculator",
      "description": "Add two numbers",
      "capabilities": { "streaming": false },
      "inputSchema": {
        "type": "object",
        "properties": { "a": { "type": "number" }, "b": { "type": "number" } },
        "required": ["a", "b"]
      },
      "outputSchema": { "type": "number" }
    },
    {
      "kind": "mcp",
      "path": "/mcp"
    }
  ]
}
```

### Agent Invoke Endpoint

`POST /agents/{name}/invoke` - Invoke an agent.

The request body wraps the agent's input inside an `input` key. For example, a calculator agent with input schema `{ properties: { a, b } }` expects `a` and `b` inside `input`:

**Task-oriented agent:**
```bash
curl -X POST http://localhost:8080/agents/calculator/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"a": 5, "b": 3}}'
```

**Response:**
```json
{
  "output": 8
}
```

**Chat agent:**

Chat agents (type `chat` or `thread`) expect `messages` inside `input`. Messages are OpenAI-style: `role` (`user` | `assistant` | `system` | `tool`), `content`, and optionally `tool_calls`, `tool_call_id`, and `name`. Use the `Message` and `ToolCall` types from `@reminix/runtime` in your handler. Chat returns a string; thread returns an array of messages.

```bash
curl -X POST http://localhost:8080/agents/assistant/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "messages": [
        {"role": "user", "content": "Hello!"}
      ]
    }
  }'
```

**Response (chat):**
```json
{
  "output": "You said: Hello!"
}
```

### MCP Endpoint

`POST /mcp` - MCP Streamable HTTP endpoint for tool discovery and execution.

Tools are exposed via [MCP (Model Context Protocol)](https://modelcontextprotocol.io) at `/mcp`. Use any MCP client, or call directly with JSON-RPC:

```bash
# Discover available tools
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# Call a tool
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_weather", "arguments": {"location": "San Francisco"}}, "id": 2}'
```

## Agents

Agents handle requests via the `/agents/{name}/invoke` endpoint.

### Agent types

You can use a **type** to get standard input/output schemas without defining them yourself. Pass `type` when creating an agent:

| Type | Input | Output | Use case |
|----------|--------|--------|----------|
| `prompt` (default) | `{ prompt: string }` | `string` | Single prompt in, text out |
| `chat` | `{ messages: Message[] }` | `string` | Multi-turn chat, final reply as string |
| `task` | `{ task: string, ... }` | JSON | Stateless, single-shot execution with structured result |
| `rag` | `{ query: string, messages?: Message[], collectionIds?: string[] }` | `string` | RAG query, optional history and collections |
| `thread` | `{ messages: Message[] }` | `Message[]` | Multi-turn with tool calls; returns updated thread |
| `workflow` | `{ task: string, steps?: Array, resume?: object, ... }` | `{ status, steps, result?, pendingAction? }` | Multi-step orchestration with branching, approvals, and parallel execution |

Messages are OpenAI-style: `role`, `content`, and optionally `tool_calls`, `tool_call_id`, and `name`. Use the exported types `Message` and `ToolCall` from `@reminix/runtime` for type-safe handlers.

```typescript
import { agent, serve, type Message, type ToolCall } from '@reminix/runtime';

const assistant = agent('assistant', {
  type: 'chat',
  description: 'Helpful assistant',
  handler: async ({ messages }) => {
    const last = (messages as Message[]).slice(-1)[0];
    return last?.role === 'user' ? `You said: ${last.content}` : 'Hello!';
  },
});

serve({ agents: [assistant] });
```

### Task-Oriented Agent

Use `agent()` for task-oriented agents that take structured input and return output (or omit `type` / use `type: 'prompt'` or `type: 'task'` for standard shapes):

```typescript
import { z } from 'zod';
import { agent, serve } from '@reminix/runtime';

// Zod schema (recommended) — typed handler, no casts needed
const calculator = agent('calculator', {
  description: 'Add two numbers',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  handler: async ({ a, b }) => a + b,
});

// JSON Schema (also supported)
const textProcessor = agent('text-processor', {
  description: 'Process text in various ways',
  inputSchema: {
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

serve({ agents: [calculator, textProcessor] });
```

### Streaming

Agents support streaming via async generators. When you use an async generator function, the agent automatically supports streaming:

```typescript
import { z } from 'zod';
import { agent, serve } from '@reminix/runtime';

const streamer = agent('streamer', {
  description: 'Stream text word by word',
  inputSchema: z.object({ text: z.string() }),
  handler: async function* ({ text }) {
    for (const word of text.split(' ')) {
      yield word + ' ';
    }
  },
});

serve({ agents: [streamer] });
```

For streaming agents:
- `stream: true` in the request → chunks are sent via SSE
- `stream: false` in the request → chunks are collected and returned as a single response

## Tools

Tools are standalone functions exposed via [MCP](https://modelcontextprotocol.io) at `/mcp`. They're useful for exposing utility functions, external API integrations, or any reusable logic. MCP clients (including LLMs and other agents) can discover and call tools using the standard MCP protocol.

### Creating Tools

Use the `tool()` factory function to create tools:

```typescript
import { z } from 'zod';
import { tool, serve } from '@reminix/runtime';

const getWeather = tool('get_weather', {
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
    units: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  outputSchema: z.object({
    temp: z.number(),
    condition: z.string(),
  }),
  handler: async ({ location }) => {
    return { temp: 72, condition: 'sunny', location };
  },
});

serve({ tools: [getWeather] });
```

### Serving Agents and Tools Together

You can serve both agents and tools from the same runtime:

```typescript
import { z } from 'zod';
import { agent, tool, serve } from '@reminix/runtime';

const summarizer = agent('summarizer', {
  description: 'Summarize text',
  inputSchema: z.object({ text: z.string() }),
  handler: async ({ text }) => text.slice(0, 100) + '...',
});

const calculator = tool('calculate', {
  description: 'Perform basic math operations',
  inputSchema: z.object({ expression: z.string() }),
  handler: async ({ expression }) => ({ result: eval(expression) }),
});

serve({ agents: [summarizer], tools: [calculator] });
```

## Framework Agents

Already using a framework? Use our pre-built agents:

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

Factory function to create an agent. Use `type` for standard I/O shapes, or provide custom `inputSchema`/`outputSchema`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the agent |
| `options.type` | `'prompt' \| 'chat' \| 'task' \| 'rag' \| 'thread' \| 'workflow'` | Optional. Standard input/output schema (default: `prompt` when no custom input/output). |
| `options.description` | `string` | Human-readable description |
| `options.inputSchema` | `JSONSchema \| ZodType` | JSON Schema or Zod schema for input (ignored if `type` is set). Zod schemas provide typed handlers and runtime validation. |
| `options.outputSchema` | `JSONSchema \| ZodType` | Optional JSON Schema or Zod schema for output (ignored if `type` is set) |
| `options.handler` | `function` | Async function or async generator |

```typescript
import { z } from 'zod';
import { agent } from '@reminix/runtime';

// Regular agent with Zod
const myAgent = agent('my-agent', {
  description: 'Does something useful',
  inputSchema: z.object({ input: z.string() }),
  handler: async ({ input }) => ({ result: input }),
});

// Streaming agent
const streamingAgent = agent('streaming-agent', {
  description: 'Streams output',
  inputSchema: z.object({ text: z.string() }),
  handler: async function* ({ text }) {
    for (const word of text.split(' ')) {
      yield word + ' ';
    }
  },
});
```

To receive request context (e.g. `user_id` from the request body), use a handler that accepts `(input, context)`: `handler: async (input, context) => { ... }`. For full request access (e.g. `stream`), use the [Agent class](#agent-class) and a handler that receives the full request object.

### `tool(name, options)`

Factory function to create a tool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the tool |
| `options.description` | `string` | Human-readable description |
| `options.inputSchema` | `JSONSchema \| ZodType` | JSON Schema or Zod schema for input. Zod schemas provide typed handlers and runtime validation. |
| `options.outputSchema` | `JSONSchema \| ZodType` | Optional JSON Schema or Zod schema for output |
| `options.handler` | `function` | Async function to call when invoked |

```typescript
import { z } from 'zod';
import { tool } from '@reminix/runtime';

const myTool = tool('my_tool', {
  description: 'Does something useful',
  inputSchema: z.object({ input: z.string() }),
  handler: async ({ input }) => ({ result: input }),
});

// With context (optional second argument receives request context)
const myToolWithContext = tool('my_tool', {
  description: 'Example with context',
  inputSchema: z.object({ param: z.string() }),
  handler: async ({ param }, context) => ({
    param,
    userId: (context as Record<string, unknown>)?.user_id ?? 'anonymous',
  }),
});
```

### Request/Response Types

```typescript
// Request: agent input is wrapped in an `input` key
// For a calculator agent with input schema { a: number, b: number }:
interface CalculatorRequest {
  input: {                              // Agent input fields
    a: number;
    b: number;
  };
  stream?: boolean;                     // Whether to stream the response
  context?: Record<string, unknown>;    // Optional metadata
}

// Response: { output: ... } (value from handler)
interface AgentResponse {
  output: unknown;
}
```

## Advanced

### Agent Base Class

For building framework integrations, extend the `Agent` base class. See the [framework agent packages](#framework-agents) for examples.

```typescript
import { Agent } from '@reminix/runtime';
import type { AgentRequest, AgentResponse } from '@reminix/runtime';

class MyFrameworkAgent extends Agent {
  private client: MyClient;

  constructor(client: MyClient, name = 'my-framework') {
    super(name, { description: 'My framework agent' });
    this.client = client;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const result = await this.client.run(request.input);
    return { output: result };
  }
}
```

### Serverless Deployment

Use `createApp()` for serverless deployments:

```typescript
import { agent, createApp } from '@reminix/runtime';

const myAgent = agent('my-agent', {
  handler: async ({ prompt }) => `Completed: ${prompt}`,
});

const app = createApp({ agents: [myAgent] });

// Vercel Edge Function
export const POST = app.fetch;
export const GET = app.fetch;

// Cloudflare Workers
export default { fetch: app.fetch };

// Bun
Bun.serve({ fetch: app.fetch });
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
