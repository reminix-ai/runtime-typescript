# @reminix/langchain

Reminix Runtime chat agent for [LangChain](https://js.langchain.com). Serve any LangChain runnable as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/langchain @langchain/core
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { LangChainChat } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const agent = new LangChainChat(llm, { name: 'my-chatbot' });
serve({ agents: [agent] });
```

Your agent is now available at:
- `POST /agents/my-chatbot/invoke` - Execute the agent

## API Reference

### `new LangChainChat(runnable, options)`

Create a LangChain chat agent for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `runnable` | `Runnable` | required | Any LangChain runnable (LLM, chain, agent, etc.) |
| `options.name` | `string` | `"langchain-agent"` | Name for the agent (used in URL path) |

**Returns:** `LangChainChat` - A Reminix chat agent instance

### Example with a Chain

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LangChainChat } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

// Create a chain
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  ['human', '{input}'],
]);
const llm = new ChatOpenAI({ model: 'gpt-4o' });
const chain = prompt.pipe(llm);

// Create agent and serve
const agent = new LangChainChat(chain, { name: 'my-chain' });
serve({ agents: [agent] });
```

## Endpoint Input/Output Formats

### POST /agents/{name}/invoke

Execute the agent. Input keys are passed directly to the LangChain runnable.

**Request:**
```json
{
  "input": "Hello, how are you?"
}
```

**Response:**
```json
{
  "output": "I'm doing well, thank you for asking!"
}
```

### Streaming

For streaming responses, set `stream: true` in the request:

```json
{
  "input": "Tell me a story",
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
- [LangChain.js Documentation](https://js.langchain.com)

## License

Apache-2.0
