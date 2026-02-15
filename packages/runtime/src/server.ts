/**
 * Reminix Runtime Server
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serve as honoServe } from '@hono/node-server';
import type { AgentLike } from './agent.js';
import type { ToolLike } from './tool.js';
import type { AgentRequest, ToolRequest, RuntimeErrorResponse } from './types.js';
import { VERSION } from './version.js';

/**
 * Enable debug mode via environment variable to include stack traces in error responses
 */
const REMINIX_CLOUD = ['true', '1', 'yes'].includes(
  (process.env.REMINIX_CLOUD || '').toLowerCase()
);

/**
 * Create a structured error response
 */
function createErrorResponse(
  error: unknown,
  errorType: string = 'ExecutionError'
): RuntimeErrorResponse {
  const message = error instanceof Error ? error.message : String(error);
  const response: RuntimeErrorResponse = {
    error: {
      type: errorType,
      message,
    },
  };

  // Include stack trace in debug mode
  if (REMINIX_CLOUD && error instanceof Error && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

export interface ServeOptions {
  port?: number;
  hostname?: string;
}

export interface CreateAppOptions {
  agents?: AgentLike[];
  tools?: ToolLike[];
}

/**
 * Create a Hono application with agent and tool endpoints.
 *
 * @param options - Options containing agents and/or tools.
 * @returns A Hono application instance.
 * @throws Error if no agents or tools are provided.
 * @throws Error if duplicate agent or tool names are found.
 */
export function createApp(options: CreateAppOptions): Hono {
  const agents = options.agents ?? [];
  const tools = options.tools ?? [];

  if (agents.length === 0 && tools.length === 0) {
    throw new Error('At least one agent or tool is required');
  }

  // Build lookup maps by name (with duplicate detection)
  const agentMap = new Map<string, AgentLike>();
  for (const agent of agents) {
    if (agentMap.has(agent.name)) {
      throw new Error(`Duplicate agent name: '${agent.name}'`);
    }
    agentMap.set(agent.name, agent);
  }

  const toolMap = new Map<string, ToolLike>();
  for (const tool of tools) {
    if (toolMap.has(tool.name)) {
      throw new Error(`Duplicate tool name: '${tool.name}'`);
    }
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
      })),
      tools: tools.map((tool) => ({
        name: tool.name,
        ...tool.metadata,
      })),
    });
  });

  // Agent invoke endpoint
  app.post('/agents/:agentName/invoke', async (c) => {
    const agentName = c.req.param('agentName');
    const agent = agentMap.get(agentName);

    if (!agent) {
      return c.json(
        createErrorResponse(new Error(`Agent '${agentName}' not found`), 'NotFoundError'),
        404
      );
    }

    const body = await c.req.json<AgentRequest>();

    const request: AgentRequest = {
      input: body.input ?? {},
      stream: body.stream === true,
      context: body.context,
    };

    // Handle streaming
    if (request.stream) {
      if (!agent.invokeStream) {
        return c.json(
          createErrorResponse(
            new Error(`Streaming not supported for agent '${agentName}'`),
            'NotImplementedError'
          ),
          501
        );
      }

      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of agent.invokeStream!(request)) {
            await stream.writeSSE({ data: JSON.stringify({ delta: chunk }) });
          }
          await stream.writeSSE({ data: JSON.stringify({ done: true }) });
        } catch (error) {
          const errorResponse = createErrorResponse(
            error,
            error instanceof Error ? error.constructor.name : 'ExecutionError'
          );
          await stream.writeSSE({ data: JSON.stringify(errorResponse) });
        }
      });
    }

    // Non-streaming: catch errors and return structured response
    try {
      const response = await agent.invoke(request);
      return c.json(response);
    } catch (error) {
      // Determine error type and status code
      let statusCode = 500;
      let errorType = error instanceof Error ? error.constructor.name : 'ExecutionError';

      if (error instanceof Error) {
        if (error.message.includes('not implemented') || error.name === 'NotImplementedError') {
          statusCode = 501;
          errorType = 'NotImplementedError';
        } else if (error.name === 'ValidationError' || error.message.includes('validation')) {
          statusCode = 400;
          errorType = 'ValidationError';
        }
      }

      return c.json(createErrorResponse(error, errorType), statusCode as 400 | 500 | 501);
    }
  });

  // Tool call endpoint
  app.post('/tools/:toolName/call', async (c) => {
    const toolName = c.req.param('toolName');
    const tool = toolMap.get(toolName);

    if (!tool) {
      return c.json(
        createErrorResponse(new Error(`Tool '${toolName}' not found`), 'NotFoundError'),
        404
      );
    }

    const body = await c.req.json<ToolRequest>();

    const request: ToolRequest = {
      input: body.input ?? {},
      context: body.context,
    };

    try {
      const result = await tool.call(request);
      return c.json(result);
    } catch (error) {
      // Determine error type and status code
      let statusCode = 500;
      let errorType = error instanceof Error ? error.constructor.name : 'ExecutionError';

      if (error instanceof Error) {
        if (error.name === 'ValidationError' || error.message.includes('validation')) {
          statusCode = 400;
          errorType = 'ValidationError';
        }
      }

      return c.json(createErrorResponse(error, errorType), statusCode as 400 | 500);
    }
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
