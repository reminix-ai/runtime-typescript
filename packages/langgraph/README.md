# @reminix/langgraph

Reminix Runtime adapter for [LangGraph](https://langchain-ai.github.io/langgraphjs/). Serve any LangGraph agent as a REST API.

> **Ready to go live?** [Deploy to Reminix](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/langgraph @langchain/langgraph
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { wrap } from '@reminix/langgraph';
import { serve } from '@reminix/runtime';

// Create a LangGraph agent
const llm = new ChatOpenAI({ model: 'gpt-4o' });
const graph = createReactAgent({ llm, tools: [] });

// Wrap it with the Reminix adapter
const agent = wrap(graph, 'my-agent');

// Serve it as a REST API
serve([agent], { port: 8080 });
```

Your agent is now available at:
- `POST /agents/my-agent/invoke` - Stateless invocation
- `POST /agents/my-agent/chat` - Conversational chat

## API Reference

### `wrap(graph, name)`

Wrap a LangGraph compiled graph for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `graph` | `CompiledGraph` | required | A LangGraph compiled graph |
| `name` | `string` | `"langgraph-agent"` | Name for the agent (used in URL path) |

**Returns:** `LangGraphAdapter` - A Reminix adapter instance

### How It Works

LangGraph uses a state-based approach. The adapter:
1. Converts incoming messages to LangChain message format
2. Invokes the graph with `{ messages: [...] }`
3. Extracts the last AI message from the response
4. Returns it in the Reminix response format

## Endpoint Input/Output Formats

### POST /agents/{name}/invoke

Stateless invocation. Input is passed directly to the graph.

**Request:**
```json
{
  "input": {
    "messages": [
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
- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)

## License

Apache-2.0
