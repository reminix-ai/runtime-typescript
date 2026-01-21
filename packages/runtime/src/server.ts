/**
 * Reminix Runtime Server
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serve as honoServe } from '@hono/node-server';
import type { AgentBase } from './agent.js';
import type { ToolBase } from './tool.js';
import type { ExecuteRequest, ToolExecuteRequest } from './types.js';
import { VERSION } from './version.js';

export interface ServeOptions {
  port?: number;
  hostname?: string;
}

export interface CreateAppOptions {
  agents?: AgentBase[];
  tools?: ToolBase[];
}

/**
 * Create a Hono application with agent and tool endpoints.
 *
 * @param options - Options containing agents and/or tools.
 * @returns A Hono application instance.
 * @throws Error if no agents or tools are provided.
 */
export function createApp(options: CreateAppOptions): Hono {
  const agents = options.agents ?? [];
  const tools = options.tools ?? [];

  if (agents.length === 0 && tools.length === 0) {
    throw new Error('At least one agent or tool is required');
  }

  // Build lookup maps by name
  const agentMap = new Map<string, AgentBase>();
  for (const agent of agents) {
    agentMap.set(agent.name, agent);
  }

  const toolMap = new Map<string, ToolBase>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  const app = new Hono();

  // Health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'ok' });
  });

  // Runtime discovery endpoint
  app.get('/info', (c) => {
    return c.json({
      runtime: {
        name: 'reminix-runtime',
        version: VERSION,
        language: 'typescript',
        framework: 'hono',
      },
      agents: agents.map((agent) => ({
        name: agent.name,
        ...agent.metadata,
        streaming: agent.streaming,
      })),
      tools: tools.map((tool) => ({
        name: tool.name,
        ...tool.metadata,
      })),
    });
  });

  // Execute endpoint
  app.post('/agents/:agentName/execute', async (c) => {
    const agentName = c.req.param('agentName');
    const agent = agentMap.get(agentName);

    if (!agent) {
      return c.json({ error: `Agent '${agentName}' not found` }, 404);
    }

    const body = await c.req.json<Record<string, unknown>>();

    // Get requestKeys from agent metadata (all agents have defaults)
    const requestKeys = (agent.metadata.requestKeys as string[]) ?? [];

    // Extract declared keys from body into input object
    // e.g., requestKeys: ['prompt'] with body { prompt: '...' } -> input = { prompt: '...' }
    const input: Record<string, unknown> = {};
    for (const key of requestKeys) {
      if (key in body) {
        input[key] = body[key];
      }
    }

    const request: ExecuteRequest = {
      input,
      stream: body.stream === true,
      context: body.context as Record<string, unknown> | undefined,
    };

    // Handle streaming
    if (request.stream) {
      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of agent.executeStream(request)) {
            await stream.writeSSE({ data: chunk });
          }
          await stream.writeSSE({ data: '[DONE]' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          await stream.writeSSE({ data: JSON.stringify({ error: message }) });
        }
      });
    }

    const response = await agent.execute(request);
    return c.json(response);
  });

  // Tool execute endpoint
  app.post('/tools/:toolName/execute', async (c) => {
    const toolName = c.req.param('toolName');
    const tool = toolMap.get(toolName);

    if (!tool) {
      return c.json({ error: `Tool '${toolName}' not found` }, 404);
    }

    const body = await c.req.json<ToolExecuteRequest>();

    const response = await tool.execute(body);
    return c.json(response);
  });

  return app;
}

export interface FullServeOptions extends ServeOptions, CreateAppOptions {}

/**
 * Serve agents and tools via REST API.
 *
 * @param options - Options containing agents, tools, and server settings.
 */
export function serve(options: FullServeOptions = {}): void {
  // Default to 0.0.0.0 for Fly's load balancer compatibility
  // Can be overridden via HOST env var or options.hostname
  const defaultHostname = process.env.HOST || '0.0.0.0';
  const defaultPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  const { port = defaultPort, hostname = defaultHostname, agents, tools } = options;

  const app = createApp({ agents, tools });

  honoServe({
    fetch: app.fetch,
    port,
    hostname,
  });

  console.log(`Reminix Runtime listening on http://${hostname}:${port}`);
}
