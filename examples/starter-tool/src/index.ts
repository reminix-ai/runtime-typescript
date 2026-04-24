/**
 * Starter Tool — the fastest way to build a tool on Reminix.
 *
 * Defines a minimal MCP tool with the `tool()` factory and serves it via MCP
 * Streamable HTTP. Tools are the atomic units agents call; Reminix exposes
 * them through a standard `/mcp` endpoint so any MCP client can discover and
 * invoke them.
 *
 * Call via MCP: POST /mcp with a JSON-RPC `tools/call` request.
 */

import { serve, tool } from '@reminix/runtime';
import { z } from 'zod';

const greet = tool('greet', {
  description: 'Greet someone by name',
  inputSchema: z.object({ name: z.string().describe('Name of the person to greet') }),
  outputSchema: z.object({ greeting: z.string() }),
  handler: async ({ name }) => ({ greeting: `Hello, ${name}!` }),
});

serve({ tools: [greet] });
