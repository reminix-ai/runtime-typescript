# @reminix/runtime

The core runtime for deploying AI agents via REST APIs. Provides a lightweight server with a unified interface for any AI framework.

## Installation

```bash
npm install @reminix/runtime
```

## Quick Start

```typescript
import { serve, Agent, InvokeRequest, InvokeResponse, ChatRequest, ChatResponse } from '@reminix/runtime';

// Create a custom agent
class MyAgent extends Agent {
  get name(): string {
    return 'my-agent';
  }

  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    // Task-oriented operation
    const task = (request.input as Record<string, string>).task || 'unknown';
    return { output: `Completed: ${task}` };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Conversational interaction
    const userMsg = request.messages[request.messages.length - 1].content;
    const response = `You said: ${userMsg}`;
    return {
      output: response,
      messages: [
        ...request.messages,
        { role: 'assistant', content: response },
      ],
    };
  }
}

// Serve the agent
serve([new MyAgent()], { port: 8080 });
```

## How It Works

The runtime creates a REST server (powered by [Hono](https://hono.dev)) with the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/agents` | GET | List available agents |
| `/agents/{name}/invoke` | POST | Task-oriented invocation |
| `/agents/{name}/chat` | POST | Multi-turn conversation |

### Invoke Endpoint

For task-oriented operations that take arbitrary input and return output.

**Request:**
```json
{
  "input": {
    "task": "summarize",
    "text": "Lorem ipsum..."
  },
  "stream": false,
  "context": {}
}
```

**Response:**
```json
{
  "output": "Summary: ..."
}
```

### Chat Endpoint

For conversational interactions with message history.

**Request:**
```json
{
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "What's the weather?"}
  ],
  "stream": false,
  "context": {}
}
```

**Response:**
```json
{
  "output": "The weather is 72°F and sunny!",
  "messages": [
    {"role": "user", "content": "What's the weather?"},
    {"role": "assistant", "content": null, "tool_calls": [...]},
    {"role": "tool", "content": "72°F, sunny", "tool_call_id": "..."},
    {"role": "assistant", "content": "The weather is 72°F and sunny!"}
  ]
}
```

The `output` field contains the final answer, while `messages` includes the full execution history (useful for agentic workflows with tool calls).

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

### `serve(agents, options)`

Start the runtime server.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `agents` | `Agent[]` | required | List of agents |
| `options.port` | `number` | `8080` | Port to listen on |
| `options.hostname` | `string` | `"0.0.0.0"` | Host to bind to |

### `createApp(agents)`

Create a Hono app without starting the server. Useful for testing or custom deployment.

```typescript
import { createApp } from '@reminix/runtime';

const app = createApp([new MyAgent()]);
// Use with any runtime: Node.js, Deno, Bun, Cloudflare Workers, etc.
```

### `Agent`

Abstract base class for building agents from scratch.

```typescript
abstract class Agent {
  abstract get name(): string;
  abstract invoke(request: InvokeRequest): Promise<InvokeResponse>;
  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  
  // Optional streaming methods
  async *invokeStream(request: InvokeRequest): AsyncGenerator<string> { ... }
  async *chatStream(request: ChatRequest): AsyncGenerator<string> { ... }
}
```

### `BaseAdapter`

Extends `Agent`. Use this when wrapping an existing AI framework.

```typescript
import { BaseAdapter, InvokeRequest, InvokeResponse, ChatRequest, ChatResponse } from '@reminix/runtime';

class MyFrameworkAdapter extends BaseAdapter {
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

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [Documentation](https://docs.reminix.ai)

## License

Apache-2.0
