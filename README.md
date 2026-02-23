# Reminix Runtime (TypeScript)

The open source runtime for serving AI agents via REST APIs. Part of [Reminix](https://reminix.com) -- the developer platform for AI agents.

Deploy to [Reminix Cloud](https://reminix.com) for zero-config hosting, or self-host anywhere.

---

A lightweight runtime for serving AI agents via REST APIs. Turn any LLM framework into a REST API with built-in streaming.

**Features:**
- **REST API Server**: Execute endpoint powered by [Hono](https://hono.dev)
- **Streaming Support**: Server-Sent Events (SSE) out of the box
- **Agent Types**: Standard patterns (prompt, chat, task, rag, thread, workflow) for common agent I/O
- **Framework Agents**: Pre-built integrations for Vercel AI, LangChain, LangGraph, OpenAI, Anthropic

## Packages

| Package | Description |
|---------|-------------|
| [`@reminix/runtime`](./packages/runtime) | Core runtime with `agent()` and `tool()` factories and agent types |
| [`@reminix/langchain`](./packages/langchain) | LangChain chat agent |
| [`@reminix/langgraph`](./packages/langgraph) | LangGraph thread and workflow agents |
| [`@reminix/openai`](./packages/openai) | OpenAI chat, task, and thread agents |
| [`@reminix/anthropic`](./packages/anthropic) | Anthropic chat, task, and thread agents |
| [`@reminix/vercel-ai`](./packages/vercel-ai) | Vercel AI SDK chat and thread agents |

## Installation

```bash
# Install the agent package for your framework (runtime is included as a peer dependency)
npm install @reminix/runtime @reminix/langchain
```

## Quick Start

### With a Framework

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { LangChainChatAgent } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const agent = new LangChainChatAgent(llm, { name: 'my-agent' });
serve({ agents: [agent] });
```

### With Factory Functions (No Framework)

```typescript
import { agent, serve } from '@reminix/runtime';

const calculator = agent('calculator', {
  description: 'Add two numbers',
  input: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  },
  handler: async ({ a, b }) => (a as number) + (b as number),
});

serve({ agents: [calculator] });
```

Your agent is now available at:
- `POST /agents/calculator/invoke` - Execute the calculator agent

See the [runtime package docs](./packages/runtime) for agent types, tools, streaming, and advanced usage.

## Using Platform Tools via MCP

When deployed to Reminix Cloud, your agents can access platform tools (memory, knowledge search) and your project tools via the MCP server. The environment variables `REMINIX_MCP_URL` and `REMINIX_API_KEY` are injected automatically.

Any framework with MCP client support works — no Reminix-specific SDK needed.

### Vercel AI SDK

```typescript
import { experimental_createMCPClient as createMCPClient } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const headers: Record<string, string> = {
  Authorization: `Bearer ${process.env.REMINIX_API_KEY}`,
};
// Optional: scope memory to a specific user
headers["X-Reminix-Identity"] = JSON.stringify({ user_id: "u_123" });

const client = await createMCPClient({
  transport: new StreamableHTTPClientTransport(
    new URL(process.env.REMINIX_MCP_URL!),
    { requestInit: { headers } }
  ),
});

const tools = await client.tools();
const result = await generateText({
  model: openai("gpt-4o"),
  tools,
  prompt: "Store my preferred language as TypeScript",
});

await client.close();
```

### Anthropic SDK

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  mcp_servers: [
    {
      type: "url",
      url: process.env.REMINIX_MCP_URL!,
      headers: {
        Authorization: `Bearer ${process.env.REMINIX_API_KEY}`,
        "X-Reminix-Identity": JSON.stringify({ user_id: "u_123" }),
      },
    },
  ],
  messages: [{ role: "user", content: "Search the knowledge base for auth docs" }],
});
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
