/**
 * MCP endpoint for Reminix Runtime — Streamable HTTP transport.
 *
 * Exposes user-deployed tools via the MCP protocol so that any MCP client
 * (Claude Desktop, Cursor, the Reminix platform, etc.) can discover and call them.
 *
 * Stateless: a fresh McpServer is created per-request, no sessions.
 */

import { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import type { Tool } from './tool.js';
import type { JSONSchema } from './types.js';
import { VERSION } from './version.js';

// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema → Zod conversion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a single JSON Schema property to a Zod type.
 */
function jsonSchemaPropertyToZod(prop: Record<string, unknown>): z.ZodTypeAny {
  let field: z.ZodTypeAny;

  switch (prop.type) {
    case 'string':
      field = prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string();
      break;
    case 'number':
    case 'integer':
      field = z.number();
      break;
    case 'boolean':
      field = z.boolean();
      break;
    case 'array':
      field = prop.items
        ? z.array(jsonSchemaPropertyToZod(prop.items as Record<string, unknown>))
        : z.array(z.any());
      break;
    case 'object':
      if (prop.properties) {
        field = z.object(jsonSchemaToZodShape(prop as JSONSchema));
      } else {
        field = z.record(z.string(), z.any());
      }
      break;
    default:
      field = z.any();
  }

  if (typeof prop.description === 'string') {
    field = field.describe(prop.description);
  }

  return field;
}

/**
 * Convert a JSON Schema object to a Zod shape suitable for McpServer.tool() registration.
 */
function jsonSchemaToZodShape(schema: JSONSchema | null | undefined): Record<string, z.ZodTypeAny> {
  if (!schema?.properties) return {};

  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(schema.required ?? []);

  for (const [key, prop] of Object.entries(
    schema.properties as Record<string, Record<string, unknown>>
  )) {
    let field = jsonSchemaPropertyToZod(prop);

    if (!required.has(key)) {
      field = field.optional();
    }

    shape[key] = field;
  }

  return shape;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MCP spec requires outputSchema to be `type: "object"`.
 * Only expose it when the tool's schema qualifies.
 */
function isObjectSchema(schema?: JSONSchema): schema is JSONSchema {
  return schema?.type === 'object';
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Hono sub-app that serves tools via MCP Streamable HTTP.
 *
 * Mount with: `app.route('/mcp', createMcpRoutes(tools))`
 */
export function createMcpRoutes(tools: Tool[]): Hono {
  const mcp = new Hono();

  // POST / — Main Streamable HTTP handler (handles all JSON-RPC messages)
  mcp.post('/', async (c) => {
    const server = new McpServer({
      name: 'reminix-runtime',
      version: VERSION,
    });

    // Register each tool on the MCP server
    for (const tool of tools) {
      const meta = tool.metadata;
      const hasObjectOutput = isObjectSchema(meta.outputSchema);

      server.registerTool(
        tool.name,
        {
          description: meta.description || `Tool: ${tool.name}`,
          inputSchema: jsonSchemaToZodShape(meta.inputSchema),
          ...(hasObjectOutput ? { outputSchema: jsonSchemaToZodShape(meta.outputSchema) } : {}),
        },
        async (args) => {
          const result = await tool.call({ arguments: args as Record<string, unknown> });
          const serialized = JSON.stringify(result.output);
          return {
            content: [{ type: 'text' as const, text: serialized }],
            ...(hasObjectOutput
              ? { structuredContent: result.output as Record<string, unknown> }
              : {}),
          };
        }
      );
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true, // JSON responses instead of SSE
    });

    await server.connect(transport);

    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      await transport.close();
      await server.close();
    }
  });

  // GET / — SSE stream (not supported in stateless mode)
  mcp.get('/', (c) => {
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'SSE streams are not supported in stateless mode. Use POST for all requests.',
        },
      },
      405
    );
  });

  // DELETE / — Session termination (no-op in stateless mode)
  mcp.delete('/', (c) => {
    return c.json({}, 200);
  });

  return mcp;
}
