/**
 * Tests for the MCP endpoint (POST /mcp).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { tool } from '../src/index.js';
import { createApp } from '../src/server.js';
import { VERSION } from '../src/version.js';

/**
 * Send a JSON-RPC message to POST /mcp and return the parsed response.
 */
async function mcpRequest(
  app: ReturnType<typeof createApp>,
  method: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const message = {
    jsonrpc: '2.0',
    id: 1,
    method,
    ...(params ? { params } : {}),
  };

  const response = await app.request('/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(message),
  });

  expect(response.status).toBe(200);

  const data = await response.json();
  return data as Record<string, unknown>;
}

// Helper tools used across tests
function createTestTools() {
  const greetTool = tool('greet', {
    description: 'Greet someone by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name to greet' },
      },
      required: ['name'],
    },
    handler: async (args) => ({ message: `Hello, ${args.name}!` }),
  });

  const addTool = tool('add', {
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
    handler: (args) => (args.a as number) + (args.b as number),
  });

  return { greetTool, addTool };
}

describe('MCP Endpoint', () => {
  describe('initialize', () => {
    it('should respond with server capabilities', async () => {
      const { greetTool } = createTestTools();
      const app = createApp({ tools: [greetTool] });

      const response = await mcpRequest(app, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      });

      expect(response.result).toBeDefined();
      const result = response.result as Record<string, unknown>;
      expect(result.protocolVersion).toBe('2025-03-26');
      expect(result.serverInfo).toEqual({
        name: 'reminix-runtime',
        version: VERSION,
      });
    });
  });

  describe('tools/list', () => {
    it('should list all registered tools', async () => {
      const { greetTool, addTool } = createTestTools();
      const app = createApp({ tools: [greetTool, addTool] });

      const response = await mcpRequest(app, 'tools/list');

      expect(response.result).toBeDefined();
      const result = response.result as { tools: { name: string; description: string }[] };
      expect(result.tools).toHaveLength(2);

      const names = result.tools.map((t) => t.name);
      expect(names).toContain('greet');
      expect(names).toContain('add');

      const greet = result.tools.find((t) => t.name === 'greet')!;
      expect(greet.description).toBe('Greet someone by name');
    });

    it('should include input schema', async () => {
      const { greetTool } = createTestTools();
      const app = createApp({ tools: [greetTool] });

      const response = await mcpRequest(app, 'tools/list');
      const result = response.result as {
        tools: { name: string; inputSchema: Record<string, unknown> }[];
      };

      const greet = result.tools.find((t) => t.name === 'greet')!;
      expect(greet.inputSchema).toBeDefined();
      expect(greet.inputSchema.type).toBe('object');
      expect(greet.inputSchema.properties).toBeDefined();
    });
  });

  describe('tools/call', () => {
    it('should execute a tool and return output', async () => {
      const { greetTool } = createTestTools();
      const app = createApp({ tools: [greetTool] });

      const response = await mcpRequest(app, 'tools/call', {
        name: 'greet',
        arguments: { name: 'World' },
      });

      expect(response.result).toBeDefined();
      const result = response.result as {
        content: { type: string; text: string }[];
      };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const output = JSON.parse(result.content[0].text);
      expect(output).toEqual({ message: 'Hello, World!' });
    });

    it('should handle numeric return values', async () => {
      const { addTool } = createTestTools();
      const app = createApp({ tools: [addTool] });

      const response = await mcpRequest(app, 'tools/call', {
        name: 'add',
        arguments: { a: 3, b: 7 },
      });

      const result = response.result as {
        content: { type: string; text: string }[];
      };

      const output = JSON.parse(result.content[0].text);
      expect(output).toBe(10);
    });

    it('should handle tool execution errors', async () => {
      const failingTool = tool('failing', {
        description: 'A tool that always fails',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          throw new Error('Something went wrong');
        },
      });

      const app = createApp({ tools: [failingTool] });

      const response = await mcpRequest(app, 'tools/call', {
        name: 'failing',
        arguments: {},
      });

      // MCP SDK wraps tool errors in the result with isError flag
      const result = response.result as { isError?: boolean; content?: { text: string }[] };
      expect(result.isError).toBe(true);
    });
  });

  describe('HTTP methods', () => {
    it('GET /mcp should return 405', async () => {
      const { greetTool } = createTestTools();
      const app = createApp({ tools: [greetTool] });

      const response = await app.request('/mcp', { method: 'GET' });
      expect(response.status).toBe(405);
    });

    it('DELETE /mcp should return 200', async () => {
      const { greetTool } = createTestTools();
      const app = createApp({ tools: [greetTool] });

      const response = await app.request('/mcp', { method: 'DELETE' });
      expect(response.status).toBe(200);
    });
  });

  describe('no tools', () => {
    it('should still serve /mcp when no tools are registered', async () => {
      const { Agent } = await import('../src/agent.js');

      class MockAgent extends Agent {
        constructor() {
          super('mock', { framework: 'mock' });
        }
        async invoke() {
          return { output: 'ok' };
        }
      }

      const app = createApp({ agents: [new MockAgent()] });

      // Initialize should still work
      const response = await mcpRequest(app, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      });

      expect(response.result).toBeDefined();
      const result = response.result as Record<string, unknown>;
      expect(result.serverInfo).toEqual({
        name: 'reminix-runtime',
        version: VERSION,
      });
    });
  });

  describe('Zod-defined tools', () => {
    it('should list a Zod-defined tool via MCP', async () => {
      const zodTool = tool('zod-greet', {
        description: 'Greet with Zod schema',
        inputSchema: z.object({
          name: z.string().describe('Name to greet'),
        }),
        handler: async ({ name }) => ({ message: `Hello, ${name}!` }),
      });

      const app = createApp({ tools: [zodTool] });

      const response = await mcpRequest(app, 'tools/list');
      const result = response.result as {
        tools: { name: string; description: string; inputSchema: Record<string, unknown> }[];
      };

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('zod-greet');
      expect(result.tools[0].inputSchema).toBeDefined();
      expect(result.tools[0].inputSchema.type).toBe('object');
      expect(result.tools[0].inputSchema.properties).toBeDefined();
    });

    it('should execute a Zod-defined tool via MCP', async () => {
      const zodTool = tool('zod-add', {
        description: 'Add with Zod',
        inputSchema: z.object({
          a: z.number(),
          b: z.number(),
        }),
        handler: async ({ a, b }) => a + b,
      });

      const app = createApp({ tools: [zodTool] });

      const response = await mcpRequest(app, 'tools/call', {
        name: 'zod-add',
        arguments: { a: 5, b: 3 },
      });

      const result = response.result as {
        content: { type: string; text: string }[];
      };
      expect(JSON.parse(result.content[0].text)).toBe(8);
    });

    it('should work with mixed JSON Schema and Zod tools', async () => {
      const jsonTool = tool('json-tool', {
        description: 'JSON Schema tool',
        inputSchema: {
          type: 'object',
          properties: { x: { type: 'number' } },
          required: ['x'],
        },
        handler: async (args) => (args.x as number) * 2,
      });

      const zodTool = tool('zod-tool', {
        description: 'Zod tool',
        inputSchema: z.object({ y: z.number() }),
        handler: async ({ y }) => y * 3,
      });

      const app = createApp({ tools: [jsonTool, zodTool] });

      const listResponse = await mcpRequest(app, 'tools/list');
      const tools = (listResponse.result as { tools: { name: string }[] }).tools;
      expect(tools.map((t) => t.name)).toContain('json-tool');
      expect(tools.map((t) => t.name)).toContain('zod-tool');
    });
  });
});
