# @reminix/langgraph

Reminix agents for [LangGraph](https://langchain-ai.github.io/langgraphjs/). Serve any LangGraph agent as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/langgraph @langchain/langgraph
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

### Thread Agent (chat-style)

```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { LangGraphThreadAgent } from '@reminix/langgraph';
import { serve } from '@reminix/runtime';

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const graph = createReactAgent({ llm, tools: [] });
const agent = new LangGraphThreadAgent(graph, { name: 'my-agent' });
serve({ agents: [agent] });
```

### Workflow Agent (multi-step with interrupt/resume)

```typescript
import { LangGraphWorkflowAgent } from '@reminix/langgraph';
import { serve } from '@reminix/runtime';

const graph = buildWorkflowGraph(); // your LangGraph compiled graph
const agent = new LangGraphWorkflowAgent(graph, { name: 'my-workflow' });
serve({ agents: [agent] });
```

Your agent is now available at:
- `POST /agents/{name}/invoke` - Execute the agent

## API Reference

### `new LangGraphThreadAgent(graph, options?)`

Create a LangGraph thread agent for chat-style interactions.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `graph` | `CompiledGraph` | required | A LangGraph compiled graph |
| `options.name` | `string` | `"langgraph-agent"` | Name for the agent (used in URL path) |
| `options.description` | `string` | `"langgraph thread agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | System instructions prepended to messages |

**Returns:** `LangGraphThreadAgent` - A Reminix thread agent instance

The thread agent:
1. Converts incoming messages to LangChain message format
2. Prepends a `SystemMessage` if `instructions` is set
3. Invokes the graph with `{ messages: [...] }`
4. Extracts the last AI message from the response
5. Returns it in the Reminix response format

### `new LangGraphWorkflowAgent(graph, options?)`

Create a LangGraph workflow agent for multi-step execution with interrupt/resume support.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `graph` | `CompiledGraph` | required | A LangGraph compiled graph |
| `options.name` | `string` | `"langgraph-workflow-agent"` | Name for the agent (used in URL path) |
| `options.description` | `string` | `"langgraph workflow agent"` | Description shown in agent metadata |
| `options.instructions` | `string` | — | Stored in metadata (not injected into graph execution) |

**Returns:** `LangGraphWorkflowAgent` - A Reminix workflow agent instance

The workflow agent:
1. Streams the graph and collects per-node outputs as steps
2. Maps `GraphInterrupt` to `pendingAction` with status `"paused"`
3. Accepts `resume` input to continue interrupted graphs via `Command`
4. Returns structured `{status, steps, result?, pendingAction?}` output

## Endpoint Input/Output Formats

### Thread Agent — POST /agents/{name}/invoke

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

### Workflow Agent — POST /agents/{name}/invoke

**Request:**
```json
{
  "input": {"task": "process data"}
}
```

**Response:**
```json
{
  "output": {
    "status": "completed",
    "steps": [
      {"name": "fetch_data", "status": "completed", "output": {"records": 10}},
      {"name": "process", "status": "completed", "output": {"summary": "done"}}
    ],
    "result": {"summary": "done"}
  }
}
```

**Resume a paused workflow:**
```json
{
  "input": {
    "task": "process data",
    "resume": {"step": "approve", "input": {"approved": true}}
  }
}
```

### Streaming

For streaming responses (thread agent only), set `stream: true` in the request:

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
