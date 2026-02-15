# @reminix/langgraph

Reminix Runtime thread agent for [LangGraph](https://langchain-ai.github.io/langgraphjs/). Serve any LangGraph agent as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/langgraph @langchain/langgraph
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { LangGraphThread } from '@reminix/langgraph';
import { serve } from '@reminix/runtime';

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const graph = createReactAgent({ llm, tools: [] });
const agent = new LangGraphThread(graph, { name: 'my-agent' });
serve({ agents: [agent] });
```

Your agent is now available at:
- `POST /agents/my-agent/invoke` - Execute the agent

## API Reference

### `new LangGraphThread(graph, options)`

Create a LangGraph thread agent for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `graph` | `CompiledGraph` | required | A LangGraph compiled graph |
| `options.name` | `string` | `"langgraph-agent"` | Name for the agent (used in URL path) |

**Returns:** `LangGraphThread` - A Reminix thread agent instance

### How It Works

LangGraph uses a state-based approach. The agent:
1. Converts incoming messages to LangChain message format
2. Invokes the graph with `{ messages: [...] }`
3. Extracts the last AI message from the response
4. Returns it in the Reminix response format

## Endpoint Input/Output Formats

### POST /agents/{name}/invoke

Execute the graph. Input keys are passed directly to the graph.

**Request:**
```json
{
  "messages": [
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

### Streaming

For streaming responses, set `stream: true` in the request:

```json
{
  "messages": [{"role": "user", "content": "Hello!"}],
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
- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)

## License

Apache-2.0
