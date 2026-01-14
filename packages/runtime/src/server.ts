/**
 * Reminix Runtime Server
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serve as honoServe } from '@hono/node-server';
import type { AgentBase } from './adapters/base.js';
import type { InvokeRequest, ChatRequest } from './types.js';
import { VERSION } from './version.js';

export interface ServeOptions {
  port?: number;
  hostname?: string;
}

/**
 * Create a Hono application with agent endpoints.
 *
 * @param agents - List of agents.
 * @returns A Hono application instance.
 * @throws Error if no agents are provided.
 */
export function createApp(agents: AgentBase[]): Hono {
  if (agents.length === 0) {
    throw new Error('At least one agent is required');
  }

  // Build a lookup map for agents by name
  const agentMap = new Map<string, AgentBase>();
  for (const agent of agents) {
    agentMap.set(agent.name, agent);
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

  return app;
}

/**
 * Serve agents via REST API.
 *
 * @param agents - List of agents.
 * @param options - Server options.
 */
export function serve(agents: AgentBase[], options: ServeOptions = {}): void {
  const { port = 8080, hostname = '0.0.0.0' } = options;

  const app = createApp(agents);

  honoServe({
    fetch: app.fetch,
    port,
    hostname,
  });

  console.log(`Reminix Runtime listening on http://${hostname}:${port}`);
}
