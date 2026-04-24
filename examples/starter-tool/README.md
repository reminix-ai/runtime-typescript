# Starter Tool

The fastest way to build a tool on Reminix — a minimal MCP tool with a JSON schema input, no API keys, no external SDKs.

[![Deploy to Reminix](https://reminix.com/badge/deploy.svg)](https://reminix.com/new/deploy?repo=reminix-ai/runtime-typescript&folder=examples/starter-tool)

## How it works

The `tool()` factory registers a typed async function as an MCP tool, with Zod `inputSchema` and `outputSchema` declaring the call surface. `serve()` hosts it behind a Streamable HTTP `/mcp` endpoint, so any MCP-compatible client (Claude Desktop, an agent framework, another Reminix agent) can discover and call it using the standard JSON-RPC protocol.

## What it does

```typescript
import { serve, tool } from '@reminix/runtime';
import { z } from 'zod';

const greet = tool('greet', {
  description: 'Greet someone by name',
  inputSchema: z.object({ name: z.string().describe('Name of the person to greet') }),
  outputSchema: z.object({ greeting: z.string() }),
  handler: async ({ name }) => ({ greeting: `Hello, ${name}!` }),
});

serve({ tools: [greet] });
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/manifest` | GET | Tool discovery |
| `/mcp` | POST | MCP Streamable HTTP — tool discovery and invocation |

## Testing

```bash
# List available tools
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Call the greet tool
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"greet","arguments":{"name":"World"}},"id":2}'
```

## Run locally

```bash
pnpm install
pnpm start
```
