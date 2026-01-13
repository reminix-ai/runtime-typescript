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
    // Your agent logic here
    return {
      content: 'Hello!',
      messages: [...request.messages, { role: 'assistant', content: 'Hello!' }],
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return {
      content: 'Hello!',
      messages: [...request.messages, { role: 'assistant', content: 'Hello!' }],
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
| `/agents/{name}/invoke` | POST | Single-turn invocation |
| `/agents/{name}/chat` | POST | Multi-turn chat |

### Request Format

```json
{
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "Hello!"}
  ],
  "context": {}
}
```

### Response Format

```json
{
  "content": "Hi there! How can I help?",
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hi there! How can I help?"}
  ]
}
```

## Framework Adapters

Instead of creating custom adapters, use our pre-built adapters for popular frameworks:

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
    // Convert messages and call your framework
    const result = await this.client.generate(request.messages);
    return {
      content: result,
      messages: [...request.messages, { role: 'assistant', content: result }],
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const result = await this.client.generate(request.messages);
    return {
      content: result,
      messages: [...request.messages, { role: 'assistant', content: result }],
    };
  }
}

// Optional: provide a wrap() factory function
export function wrap(client: MyFrameworkClient, name = 'my-framework'): MyFrameworkAdapter {
  return new MyFrameworkAdapter(client, name);
}
```

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [Documentation](https://docs.reminix.ai)

## License

Apache-2.0
