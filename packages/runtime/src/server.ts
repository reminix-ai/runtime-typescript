/**
 * Reminix Runtime Server
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serve as honoServe } from '@hono/node-server';
import type { AgentBase } from './agent.js';
import type { ToolBase } from './tool.js';
import type { InvokeRequest, ChatRequest, ToolExecuteRequest } from './types.js';
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
        invoke: { streaming: agent.invokeStreaming },
        chat: { streaming: agent.chatStreaming },
      })),
      tools: tools.map((tool) => ({
        name: tool.name,
        ...tool.metadata,
      })),
    });
  });

  // Invoke endpoint
  app.post('/agents/:agentName/invoke', async (c) => {
    const agentName = c.req.param('agentName');
    const agent = agentMap.get(agentName);

    if (!agent) {
      return c.json({ error: `Agent '${agentName}' not found` }, 404);
    }

    const body = await c.req.json<InvokeRequest>();

    // Validate request
    if (!body.input || Object.keys(body.input).length === 0) {
      return c.json({ error: 'input is required and must not be empty' }, 400);
    }

    // Handle streaming
    if (body.stream) {
      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of agent.invokeStream(body)) {
            await stream.writeSSE({ data: chunk });
          }
          await stream.writeSSE({ data: '[DONE]' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          await stream.writeSSE({ data: JSON.stringify({ error: message }) });
        }
      });
    }

    const response = await agent.invoke(body);
    return c.json(response);
  });

  // Chat endpoint
  app.post('/agents/:agentName/chat', async (c) => {
    const agentName = c.req.param('agentName');
    const agent = agentMap.get(agentName);

    if (!agent) {
      return c.json({ error: `Agent '${agentName}' not found` }, 404);
    }

    const body = await c.req.json<ChatRequest>();

    // Validate request
    if (!body.messages || body.messages.length === 0) {
      return c.json({ error: 'messages is required and must not be empty' }, 400);
    }

    // Handle streaming
    if (body.stream) {
      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of agent.chatStream(body)) {
            await stream.writeSSE({ data: chunk });
          }
          await stream.writeSSE({ data: '[DONE]' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          await stream.writeSSE({ data: JSON.stringify({ error: message }) });
        }
      });
    }

    const response = await agent.chat(body);
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
