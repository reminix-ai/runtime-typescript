# Reminix Runtime (TypeScript)

A lightweight runtime for serving AI agents via REST APIs. Wrap any LLM framework and get invoke/chat endpoints with built-in streaming.

**Features:**
- **REST API Server**: Invoke and chat endpoints powered by [Hono](https://hono.dev)
- **Streaming Support**: Server-Sent Events (SSE) out of the box
- **Framework Adapters**: Pre-built integrations for Vercel AI, LangChain, LangGraph, OpenAI, Anthropic

## Packages

| Package | Description |
|---------|-------------|
| [`@reminix/runtime`](./packages/runtime) | Core runtime with `serve()`, invoke/chat handlers, and base adapter |
| [`@reminix/langchain`](./packages/langchain) | LangChain adapter |
| [`@reminix/langgraph`](./packages/langgraph) | LangGraph adapter |
| [`@reminix/openai`](./packages/openai) | OpenAI Agents adapter |
| [`@reminix/anthropic`](./packages/anthropic) | Anthropic adapter |
| [`@reminix/vercel-ai`](./packages/vercel-ai) | Vercel AI SDK adapter |

## Installation

```bash
# Install the adapter for your framework (runtime is included as a peer dependency)
npm install @reminix/runtime @reminix/langchain
```

## Quick Start

### With a Framework

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { wrap } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

const agent = new ChatOpenAI({ model: 'gpt-4o' });

serve({ agents: [wrap(agent, { name: 'my-agent' })], port: 8080 });
```

### With Handlers (No Framework)

```typescript
import { Agent, serve } from '@reminix/runtime';

const agent = new Agent('my-agent')
  .onInvoke(async (request) => {
    return { output: `Received: ${JSON.stringify(request.input)}` };
  })
  .onChat(async (request) => {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    return {
      output: `You said: ${lastMessage}`,
      messages: [...request.messages, { role: 'assistant', content: `You said: ${lastMessage}` }]
    };
  });

serve({ agents: [agent], port: 8080 });
```

Your agent is now available at:
- `POST /agents/my-agent/invoke` - Stateless invocation
- `POST /agents/my-agent/chat` - Conversational chat

## Development

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (recommended)

### Setup

```bash
# Clone the repository
git clone https://github.com/reminix-ai/runtime-typescript.git
cd runtime-typescript

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running Examples

```bash
# Run the LangChain example
cd examples/langchain-basic
pnpm start
```

See the [examples/](./examples) directory for more.

### Running Tests

```bash
# Run all tests across all packages
pnpm test

# Run tests for a specific package
cd packages/runtime
pnpm test
```

### Running Integration Tests

Integration tests require API keys. Create a `.env` file from the example:

```bash
cp .env.example .env
# Edit .env with your API keys
```

Then run:

```bash
# Run all integration tests
pnpm test:integration

# Run OpenAI integration tests only
pnpm test:integration:openai

# Run Anthropic integration tests only
pnpm test:integration:anthropic
```

### Building

```bash
pnpm build
```

### Code Quality

```bash
# Format code (auto-fix)
pnpm format

# Check formatting (CI)
pnpm format:check

# Lint code
pnpm lint

# Type check
pnpm typecheck

# Run all checks (before pushing)
pnpm check

# Run all checks + tests (before pushing)
pnpm prepush
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

Apache-2.0
