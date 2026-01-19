# @reminix/langchain

Reminix Runtime adapter for [LangChain](https://js.langchain.com). Serve any LangChain runnable as a REST API.

> **Ready to go live?** [Deploy to Reminix Cloud](https://reminix.com/docs/deployment) for zero-config hosting, or [self-host](https://reminix.com/docs/deployment/self-hosting) on your own infrastructure.

## Installation

```bash
npm install @reminix/langchain @langchain/core
```

This will also install `@reminix/runtime` as a dependency.

## Quick Start

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { serveAgent } from '@reminix/langchain';

const llm = new ChatOpenAI({ model: 'gpt-4o' });
serveAgent(llm, { name: 'my-chatbot', port: 8080 });
```

For more flexibility (e.g., serving multiple agents), use `wrapAgent` and `serve` separately:

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { wrapAgent } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const agent = wrapAgent(llm, 'my-chatbot');
serve({ agents: [agent], port: 8080 });
```

Your agent is now available at:
- `POST /agents/my-chatbot/invoke` - Stateless invocation
- `POST /agents/my-chatbot/chat` - Conversational chat

## API Reference

### `serveAgent(runnable, options)`

Wrap a LangChain runnable and serve it immediately. Combines `wrapAgent` and `serve` for single-agent setups.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `runnable` | `Runnable` | required | Any LangChain runnable (LLM, chain, agent, etc.) |
| `options.name` | `string` | `"langchain-agent"` | Name for the agent (used in URL path) |
| `options.port` | `number` | `8080` | Port to serve on |
| `options.hostname` | `string` | `"0.0.0.0"` | Hostname to bind to |

### `wrapAgent(runnable, name)`

Wrap a LangChain runnable for use with Reminix Runtime. Use this with `serve` from `@reminix/runtime` for multi-agent setups.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `runnable` | `Runnable` | required | Any LangChain runnable (LLM, chain, agent, etc.) |
| `name` | `string` | `"langchain-agent"` | Name for the agent (used in URL path) |

**Returns:** `LangChainAdapter` - A Reminix adapter instance

### Example with a Chain

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { wrapAgent } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

// Create a chain
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  ['human', '{input}'],
]);
const llm = new ChatOpenAI({ model: 'gpt-4o' });
const chain = prompt.pipe(llm);

// Wrap and serve
const agent = wrapAgent(chain, 'my-chain');
serve({ agents: [agent], port: 8080 });
```

## Endpoint Input/Output Formats

### POST /agents/{name}/invoke

Stateless invocation. Input is passed directly to the LangChain runnable.

**Request:**
```json
{
  "input": {
    "input": "Hello, how are you?"
  }
}
```

**Response:**
```json
{
  "output": "I'm doing well, thank you for asking!"
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

## Deployment

Ready to go live?

- **[Deploy to Reminix Cloud](https://reminix.com/docs/deployment)** - Zero-config cloud hosting
- **[Self-host](https://reminix.com/docs/deployment/self-hosting)** - Run on your own infrastructure

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [LangChain.js Documentation](https://js.langchain.com)

## License

Apache-2.0
