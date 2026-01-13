# Reminix Runtime (TypeScript)

Deploy AI agents to Reminix. Lightweight runtime with adapters for LangChain, LangGraph, OpenAI, Anthropic, Vercel AI, and more.

## Packages

| Package | Description |
|---------|-------------|
| [`@reminix/runtime`](./packages/runtime) | Core runtime with `serve()` and base adapter interface |
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

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { wrap } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

// Create your agent with any framework
const agent = createLangChainAgent({ model: new ChatOpenAI(), tools: [...] });

// Serve it via Reminix
serve([wrap(agent)], { port: 8080 });
```

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
pnpm test
```

### Building

```bash
pnpm build
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

Apache-2.0
