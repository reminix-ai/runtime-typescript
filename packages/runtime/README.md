# @reminix/runtime

Core runtime package for serving AI agents and tools via REST APIs. Provides the `serve()` function, `Agent` class, `tool()` factory, and `AgentAdapter` for building framework integrations.

Built on [Hono](https://hono.dev) for portability across Node.js, Deno, Bun, and edge runtimes.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/runtime
```

## Quick Start

```typescript
import { serve, Agent } from '@reminix/runtime';

// Create an agent with callbacks
const agent = new Agent('my-agent');

agent.onInvoke(async (request) => {
  const task = (request.input as Record<string, string>).task || 'unknown';
  return { output: `Completed: ${task}` };
});

agent.onChat(async (request) => {
  const userMsg = request.messages[request.messages.length - 1].content;
  const response = `You said: ${userMsg}`;
  return {
    output: response,
    messages: [
      ...request.messages,
      { role: 'assistant', content: response },
    ],
  };
});

// Serve the agent
serve({ agents: [agent], port: 8080 });
```

## How It Works

The runtime creates a REST server (powered by [Hono](https://hono.dev)) with the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/info` | GET | Runtime discovery (version, agents, tools) |
| `/agents/{name}/invoke` | POST | Stateless invocation |
| `/agents/{name}/chat` | POST | Conversational chat |
| `/tools/{name}/execute` | POST | Execute a tool |

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
    "version": "0.0.6",
    "language": "typescript",
    "framework": "hono"
  },
  "agents": [
    {
      "name": "my-agent",
      "type": "agent",
      "invoke": { "streaming": false },
      "chat": { "streaming": false }
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

### Invoke Endpoint

`POST /agents/{name}/invoke` - For stateless operations.

```bash
curl -X POST http://localhost:8080/agents/my-agent/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "task": "summarize",
      "text": "Lorem ipsum..."
    }
  }'
```

**Response:**
```json
{
  "output": "Summary: ..."
}
```

### Chat Endpoint

`POST /agents/{name}/chat` - For conversational interactions.

```bash
curl -X POST http://localhost:8080/agents/my-agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are helpful"},
      {"role": "user", "content": "What is the weather?"}
    ]
  }'
```

**Response:**
```json
{
  "output": "The weather is 72°F and sunny!",
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "What is the weather?"},
    {"role": "assistant", "content": "The weather is 72°F and sunny!"}
  ]
}
```

The `output` field contains the assistant's response, while `messages` includes the full conversation history.

### Tool Execute Endpoint

`POST /tools/{name}/execute` - Execute a standalone tool.

```bash
curl -X POST http://localhost:8080/tools/get_weather/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "location": "San Francisco"
    }
  }'
```

**Response:**
```json
{
  "output": { "temp": 72, "condition": "sunny" }
}
```

## Tools

Tools are standalone functions that can be served via the runtime. They're useful for exposing utility functions, external API integrations, or any reusable logic.

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
  // Optional: define output schema for documentation and type inference
  output: {
    type: 'object',
    properties: {
      temp: { type: 'number' },
      condition: { type: 'string' },
      location: { type: 'string' },
    },
  },
  execute: async (input) => {
    const location = input.location as string;
    // Call weather API...
    return { temp: 72, condition: 'sunny', location };
  },
});

// Serve tools (with or without agents)
serve({ tools: [getWeather], port: 8080 });
```

The optional `output` property defines the JSON Schema for the tool's return value. This is included in the `/info` endpoint for documentation and enables better type inference for clients.

### Serving Agents and Tools Together

You can serve both agents and tools from the same runtime:

```typescript
import { Agent, tool, serve } from '@reminix/runtime';

const agent = new Agent('my-agent');
agent.onInvoke(async (req) => ({ output: 'Hello!' }));

const calculator = tool('calculate', {
  description: 'Perform basic math operations',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Math expression to evaluate' },
    },
    required: ['expression'],
  },
  execute: async (input) => {
    const expr = input.expression as string;
    return { result: eval(expr) }; // Note: use a safe evaluator in production
  },
});

serve({ agents: [agent], tools: [calculator], port: 8080 });
```

## Framework Adapters

Instead of creating custom agents, use our pre-built adapters for popular frameworks:

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

### `tool(name, options)`

Factory function to create a tool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the tool |
| `options.description` | `string` | Human-readable description |
| `options.parameters` | `object` | JSON Schema for input parameters |
| `options.execute` | `function` | Async function to execute when called |

```typescript
import { tool } from '@reminix/runtime';

const myTool = tool('my_tool', {
  description: 'Does something useful',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
    required: ['input'],
  },
  execute: async (input) => {
    return { result: input.input };
  },
});
```

### `Agent`

Concrete class for building agents with callbacks.

```typescript
import { Agent } from '@reminix/runtime';

const agent = new Agent('my-agent', { metadata: { version: '1.0' } });

agent.onInvoke(async (request) => {
  return { output: 'Hello!' };
});

agent.onChat(async (request) => {
  return { output: 'Hi!', messages: [...] };
});

// Optional: streaming handlers
agent.onInvokeStream(async function* (request) {
  yield '{"chunk": "Hello"}';
  yield '{"chunk": " world!"}';
});

agent.onChatStream(async function* (request) {
  yield '{"chunk": "Hi"}';
});
```

| Method | Description |
|--------|-------------|
| `onInvoke(fn)` | Register invoke handler, returns `this` for chaining |
| `onChat(fn)` | Register chat handler, returns `this` for chaining |
| `onInvokeStream(fn)` | Register streaming invoke handler |
| `onChatStream(fn)` | Register streaming chat handler |
| `toHandler()` | Returns a web-standard fetch handler for serverless |

### `agent.toHandler()`

Returns a web-standard `(Request) => Promise<Response>` handler for serverless deployments.

```typescript
// Vercel Edge Function
import { Agent } from '@reminix/runtime';

const agent = new Agent('my-agent');
agent.onInvoke(async (req) => ({ output: 'Hello!' }));

export const POST = agent.toHandler();
export const GET = agent.toHandler();

// Cloudflare Workers
export default { fetch: agent.toHandler() };

// Deno Deploy
Deno.serve(agent.toHandler());

// Bun
Bun.serve({ fetch: agent.toHandler() });
```

### `AgentAdapter`

Abstract base class for framework adapters. Use this when wrapping an existing AI framework.

```typescript
import { AgentAdapter, InvokeRequest, InvokeResponse, ChatRequest, ChatResponse } from '@reminix/runtime';

class MyFrameworkAdapter extends AgentAdapter {
  // Adapter name shown in /info endpoint
  static adapterName = 'my-framework';
  
  // AgentAdapter defaults both to true; override if your adapter doesn't support streaming
  // override readonly invokeStreaming = false;
  // override readonly chatStreaming = false;

  private client: MyFrameworkClient;
  private _name: string;

  constructor(client: MyFrameworkClient, name = 'my-framework') {
    super();
    this.client = client;
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    // Pass input to your framework
    const result = await this.client.run(request.input);
    return { output: result };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Convert messages and call your framework
    const result = await this.client.chat(request.messages);
    return {
      output: result,
      messages: [...request.messages, { role: 'assistant', content: result }],
    };
  }
}

// Optional: provide a wrap() factory function
export function wrap(client: MyFrameworkClient, name = 'my-framework'): MyFrameworkAdapter {
  return new MyFrameworkAdapter(client, name);
}
```

### Request/Response Types

```typescript
interface InvokeRequest {
  input: Record<string, unknown>;  // Arbitrary input for task execution
  stream?: boolean;                // Whether to stream the response
  context?: Record<string, unknown>;  // Optional metadata
}

interface InvokeResponse {
  output: unknown;                 // The result (can be any type)
}

interface ChatRequest {
  messages: Message[];             // Conversation history
  stream?: boolean;                // Whether to stream the response
  context?: Record<string, unknown>;  // Optional metadata
}

interface ChatResponse {
  output: string;                  // The final answer
  messages: Message[];             // Full execution history
}
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
