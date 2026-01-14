# @reminix/langchain

Reminix Runtime adapter for [LangChain](https://js.langchain.com). Deploy any LangChain runnable as a REST API.

## Installation

```bash
npm install @reminix/runtime @reminix/langchain @langchain/core
```

## Quick Start

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { wrap } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

// Create a LangChain model or chain
const llm = new ChatOpenAI({ model: 'gpt-4o' });

// Wrap it with the Reminix adapter
const agent = wrap(llm, 'my-chatbot');

// Serve it as a REST API
serve([agent], { port: 8080 });
```

Your agent is now available at:
- `POST /agents/my-chatbot/invoke` - Stateless invocation
- `POST /agents/my-chatbot/chat` - Conversational chat

## API Reference

### `wrap(runnable, name)`

Wrap a LangChain runnable for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `runnable` | `Runnable` | required | Any LangChain runnable (LLM, chain, agent, etc.) |
| `name` | `string` | `"langchain-agent"` | Name for the agent (used in URL path) |

**Returns:** `LangChainAdapter` - A Reminix adapter instance

### Example with a Chain

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { wrap } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

// Create a chain
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  ['human', '{input}'],
]);
const llm = new ChatOpenAI({ model: 'gpt-4o' });
const chain = prompt.pipe(llm);

// Wrap and serve
const agent = wrap(chain, 'my-chain');
serve([agent], { port: 8080 });
```

## Runtime Documentation

For information about the server, endpoints, request/response formats, and more, see the [`@reminix/runtime`](https://www.npmjs.com/package/@reminix/runtime) package.

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [LangChain.js Documentation](https://js.langchain.com)

## License

Apache-2.0
