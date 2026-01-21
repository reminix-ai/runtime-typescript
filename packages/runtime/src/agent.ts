/**
 * Agent classes for Reminix Runtime.
 */

import type { ExecuteRequest, ExecuteResponse, Message } from './types.js';
import { VERSION } from './version.js';

/**
 * Default parameters schema for agents.
 * Request: { prompt: '...' }
 */
const DEFAULT_AGENT_PARAMETERS = {
  type: 'object' as const,
  properties: {
    prompt: { type: 'string', description: 'The prompt or task for the agent' },
  },
  required: ['prompt'],
};

/**
 * Web-standard fetch handler type.
 */
export type FetchHandler = (request: Request) => Promise<Response>;

/**
 * Metadata returned by agents for discovery.
 */
export interface AgentMetadata {
  type: 'agent' | 'chat_agent' | 'adapter';
  adapter?: string;
  /** Top-level keys expected in request body (besides stream, context) */
  requestKeys?: string[];
  /** Top-level keys returned in response */
  responseKeys?: string[];
  [key: string]: unknown;
}

/**
 * Handler type for execute requests.
 */
export type ExecuteHandler = (request: ExecuteRequest) => Promise<ExecuteResponse>;

/**
 * Handler type for streaming execute requests.
 */
export type ExecuteStreamHandler = (
  request: ExecuteRequest
) => AsyncGenerator<string, void, unknown>;

/**
 * Abstract base class defining the agent interface.
 *
 * This is the core contract that all agents must fulfill.
 * Use `Agent` for callback-based registration or extend
 * `AgentAdapter` for framework adapters.
 */
export abstract class AgentBase {
  /**
   * Whether execute supports streaming. Override to enable.
   */
  get streaming(): boolean {
    return false;
  }

  /**
   * Return the agent name.
   */
  abstract get name(): string;

  /**
   * Return agent metadata for discovery.
   * Override this to provide custom metadata.
   */
  get metadata(): AgentMetadata {
    return {
      type: 'agent',
      parameters: DEFAULT_AGENT_PARAMETERS,
      requestKeys: ['prompt'],
      responseKeys: ['output'],
    };
  }

  /**
   * Handle an execute request.
   */
  abstract execute(request: ExecuteRequest): Promise<ExecuteResponse>;

  /**
   * Handle a streaming execute request.
   */
  // eslint-disable-next-line require-yield
  async *executeStream(_request: ExecuteRequest): AsyncGenerator<string, void, unknown> {
    throw new Error('Streaming not implemented for this agent');
  }

  /**
   * Create a web-standard fetch handler for this agent.
   *
   * Works with Vercel Edge Functions, Cloudflare Workers, Deno Deploy, Bun,
   * and any platform supporting the Fetch API.
   *
   * @example
   * ```typescript
   * // Vercel Edge Function
   * const agent = new Agent('my-agent');
   * agent.onExecute(async (req) => ({ output: 'Hello!' }));
   * export default agent.toHandler();
   *
   * // Cloudflare Worker
   * export default { fetch: agent.toHandler() };
   * ```
   */
  toHandler(): FetchHandler {
    return async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      try {
        // GET /health
        if (method === 'GET' && path === '/health') {
          return Response.json({ status: 'ok' }, { headers: corsHeaders });
        }

        // GET /info
        if (method === 'GET' && path === '/info') {
          return Response.json(
            {
              runtime: {
                name: 'reminix-runtime',
                version: VERSION,
                language: 'typescript',
                framework: 'fetch',
              },
              agents: [
                {
                  name: this.name,
                  ...this.metadata,
                  streaming: this.streaming,
                },
              ],
            },
            { headers: corsHeaders }
          );
        }

        // POST /agents/{name}/execute
        const executeMatch = path.match(/^\/agents\/([^/]+)\/execute$/);
        if (method === 'POST' && executeMatch) {
          const agentName = executeMatch[1];
          if (agentName !== this.name) {
            return Response.json(
              { error: `Agent '${agentName}' not found` },
              { status: 404, headers: corsHeaders }
            );
          }

          const body = (await request.json()) as Record<string, unknown>;

          // Get requestKeys from agent metadata (all agents have defaults)
          const requestKeys = (this.metadata.requestKeys as string[]) ?? [];

          // Extract declared keys from body into input object
          // e.g., requestKeys: ['prompt'] with body { prompt: '...' } -> input = { prompt: '...' }
          const input: Record<string, unknown> = {};
          for (const key of requestKeys) {
            if (key in body) {
              input[key] = body[key];
            }
          }

          const executeRequest: ExecuteRequest = {
            input,
            stream: body.stream === true,
            context: body.context as Record<string, unknown> | undefined,
          };

          // Handle streaming
          if (executeRequest.stream) {
            const stream = new ReadableStream({
              start: async (controller) => {
                const encoder = new TextEncoder();
                try {
                  for await (const chunk of this.executeStream(executeRequest)) {
                    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Unknown error';
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
                  );
                }
                controller.close();
              },
            });

            return new Response(stream, {
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
              },
            });
          }

          const response = await this.execute(executeRequest);
          return Response.json(response, { headers: corsHeaders });
        }

        // Not found
        return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return Response.json({ error: message }, { status: 500, headers: corsHeaders });
      }
    };
  }
}

/**
 * Concrete agent with callback-based handler registration.
 *
 * Use this class to create custom agents by registering handlers:
 *
 * ```typescript
 * const agent = new Agent('my-agent');
 *
 * agent.onExecute(async (request) => {
 *   return { output: 'Hello!' };
 * });
 *
 * serve({ agents: [agent], port: 8080 });
 * ```
 */
export class Agent extends AgentBase {
  private readonly _name: string;
  private readonly _metadata: Record<string, unknown>;

  private _executeHandler: ExecuteHandler | null = null;
  private _executeStreamHandler: ExecuteStreamHandler | null = null;

  /**
   * Create a new agent.
   *
   * @param name - The agent name (used in URLs like /agents/{name}/execute)
   * @param options - Optional configuration
   */
  constructor(name: string, options?: { metadata?: Record<string, unknown> }) {
    super();
    this._name = name;
    this._metadata = options?.metadata ?? {};
  }

  /**
   * Return the agent name.
   */
  get name(): string {
    return this._name;
  }

  /**
   * Return agent metadata for discovery.
   */
  get metadata(): AgentMetadata {
    return {
      type: 'agent',
      parameters: DEFAULT_AGENT_PARAMETERS,
      requestKeys: ['prompt'],
      responseKeys: ['output'],
      ...this._metadata,
    };
  }

  /**
   * Whether execute supports streaming.
   */
  override get streaming(): boolean {
    return this._executeStreamHandler !== null;
  }

  /**
   * Register an execute handler.
   *
   * @example
   * agent.onExecute(async (request) => {
   *   return { output: 'Hello!' };
   * });
   */
  onExecute(handler: ExecuteHandler): this {
    this._executeHandler = handler;
    return this;
  }

  /**
   * Register a streaming execute handler.
   *
   * @example
   * agent.onExecuteStream(async function* (request) {
   *   yield '{"chunk": "Hello"}';
   *   yield '{"chunk": " world!"}';
   * });
   */
  onExecuteStream(handler: ExecuteStreamHandler): this {
    this._executeStreamHandler = handler;
    return this;
  }

  /**
   * Handle an execute request.
   */
  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    if (this._executeHandler === null) {
      throw new Error(`No execute handler registered for agent '${this._name}'`);
    }
    return this._executeHandler(request);
  }

  /**
   * Handle a streaming execute request.
   */
  async *executeStream(request: ExecuteRequest): AsyncGenerator<string, void, unknown> {
    if (this._executeStreamHandler === null) {
      throw new Error(`No streaming execute handler registered for agent '${this._name}'`);
    }
    yield* this._executeStreamHandler(request);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Options for creating an agent with the agent() factory.
 */
export interface AgentOptions {
  /** Human-readable description of what the agent does */
  description?: string;
  /** Optional metadata for discovery */
  metadata?: Record<string, unknown>;
  /**
   * JSON Schema for input parameters.
   * The keys in `properties` become the top-level request keys.
   * Defaults to { prompt: string } if not provided.
   */
  parameters?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** JSON Schema for output */
  output?: Record<string, unknown>;
  /**
   * Execute handler - can be a regular async function or an async generator for streaming.
   *
   * Regular function: Returns output directly
   * Async generator: Yields string chunks (automatically collected for non-streaming requests)
   */
  execute:
    | ((input: Record<string, unknown>, context?: Record<string, unknown>) => Promise<unknown>)
    | ((
        input: Record<string, unknown>,
        context?: Record<string, unknown>
      ) => AsyncGenerator<string, void, unknown>);
}

/**
 * Options for creating a chat agent with the chatAgent() factory.
 */
export interface ChatAgentOptions {
  /** Human-readable description of what the agent does */
  description?: string;
  /** Optional metadata for discovery */
  metadata?: Record<string, unknown>;
  /**
   * Execute handler - can be a regular async function or an async generator for streaming.
   *
   * Regular function: Returns a Message object
   * Async generator: Yields string chunks (automatically collected for non-streaming requests)
   */
  execute:
    | ((messages: Message[], context?: Record<string, unknown>) => Promise<Message>)
    | ((
        messages: Message[],
        context?: Record<string, unknown>
      ) => AsyncGenerator<string, void, unknown>);
}

/**
 * Detect if a function is an async generator function.
 */
function isAsyncGeneratorFunction(
  fn: unknown
): fn is (...args: unknown[]) => AsyncGenerator<unknown, void, unknown> {
  return fn?.constructor?.name === 'AsyncGeneratorFunction';
}

/**
 * Wrap output schema to match the full response structure based on responseKeys.
 *
 * If responseKeys = ["output"], wraps the schema as { output: <schema> }
 * If responseKeys = ["message"], wraps the schema as { message: <schema> }
 * If responseKeys = ["message", "output"], wraps as { message: <schema>, output: <schema> }
 *
 * @param outputSchema - The schema for the return value (or undefined)
 * @param responseKeys - List of top-level response keys
 * @returns Wrapped schema describing the full response object, or undefined if outputSchema is undefined
 */
function wrapOutputSchemaForResponseKeys(
  outputSchema: Record<string, unknown> | undefined,
  responseKeys: string[]
): Record<string, unknown> | undefined {
  if (outputSchema === undefined || responseKeys.length === 0) {
    return undefined;
  }

  // If single response key, wrap the output schema
  if (responseKeys.length === 1) {
    return {
      type: 'object',
      properties: { [responseKeys[0]]: outputSchema },
      required: responseKeys,
    };
  }

  // Multiple response keys - need to split the output schema
  // For now, assume the output schema describes the first key's value
  // and other keys are optional/unknown
  const properties: Record<string, unknown> = { [responseKeys[0]]: outputSchema };
  const required = [responseKeys[0]];

  // For additional keys, we don't know their schema, so mark as optional
  // Users can override via metadata if they need full schema
  for (const key of responseKeys.slice(1)) {
    properties[key] = { type: 'object' }; // Placeholder - should be overridden
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Create an agent from a configuration object.
 *
 * By default, agents expect `{ prompt: string }` in the request body and
 * return `{ output: ... }`. You can customize by providing `parameters`.
 *
 * @example
 * ```typescript
 * // Simple agent with default parameters
 * // Request: { prompt: 'Hello world' }
 * // Response: { output: 'You said: Hello world' }
 * const echo = agent('echo', {
 *   description: 'Echo the prompt',
 *   execute: async ({ prompt }) => `You said: ${prompt}`,
 * });
 *
 * // Agent with custom parameters
 * // Request: { a: 1, b: 2 }
 * // Response: { output: 3 }
 * const calculator = agent('calculator', {
 *   description: 'Add two numbers',
 *   parameters: {
 *     type: 'object',
 *     properties: { a: { type: 'number' }, b: { type: 'number' } },
 *     required: ['a', 'b'],
 *   },
 *   execute: async ({ a, b }) => (a as number) + (b as number),
 * });
 *
 * // Streaming agent (async generator)
 * // Request: { prompt: 'hello world' }
 * // Response: { output: 'hello world ' } (streamed)
 * const streamer = agent('streamer', {
 *   description: 'Stream text word by word',
 *   execute: async function* ({ prompt }) {
 *     for (const word of (prompt as string).split(' ')) {
 *       yield word + ' ';
 *     }
 *   },
 * });
 * ```
 */
export function agent(name: string, options: AgentOptions): Agent {
  // Use provided parameters or default to { prompt: string }
  const parameters = options.parameters ?? DEFAULT_AGENT_PARAMETERS;

  // Derive requestKeys from parameters.properties
  const requestKeys = Object.keys(parameters.properties);

  // Default responseKeys (can be overridden via metadata)
  const responseKeys = ['output'];

  // Wrap output schema to match responseKeys structure
  const wrappedOutput = wrapOutputSchemaForResponseKeys(options.output, responseKeys);

  // Build metadata (allow metadata override to change responseKeys)
  const baseMetadata: Record<string, unknown> = {
    type: 'agent',
    description: options.description,
    parameters,
    requestKeys,
    responseKeys,
  };

  // If metadata override includes responseKeys, re-wrap output schema
  const finalResponseKeys =
    (options.metadata?.responseKeys as string[] | undefined) ?? responseKeys;
  const finalWrappedOutput =
    (options.metadata?.responseKeys as string[] | undefined) !== undefined
      ? wrapOutputSchemaForResponseKeys(options.output, finalResponseKeys)
      : wrappedOutput;

  if (finalWrappedOutput !== undefined) {
    baseMetadata.output = finalWrappedOutput;
  }

  const agentInstance = new Agent(name, {
    metadata: {
      ...baseMetadata,
      ...options.metadata,
    },
  });

  // Detect if execute is an async generator function
  const isStreaming = isAsyncGeneratorFunction(options.execute);

  // Get the response key from the agent's metadata (allows custom override)
  const getResponseKey = () => {
    const keys = agentInstance.metadata.responseKeys as string[] | undefined;
    return keys?.[0] ?? 'output';
  };

  if (isStreaming) {
    const streamExecute = options.execute as (
      input: Record<string, unknown>,
      context?: Record<string, unknown>
    ) => AsyncGenerator<string, void, unknown>;

    // Register streaming execute handler
    agentInstance.onExecuteStream(async function* (request: ExecuteRequest) {
      yield* streamExecute(request.input, request.context);
    });

    // Also register non-streaming handler that collects chunks
    agentInstance.onExecute(async (request: ExecuteRequest): Promise<ExecuteResponse> => {
      const chunks: string[] = [];
      for await (const chunk of streamExecute(request.input, request.context)) {
        chunks.push(chunk);
      }
      return { [getResponseKey()]: chunks.join('') };
    });
  } else {
    const regularExecute = options.execute as (
      input: Record<string, unknown>,
      context?: Record<string, unknown>
    ) => Promise<unknown>;

    agentInstance.onExecute(async (request: ExecuteRequest): Promise<ExecuteResponse> => {
      const result = await regularExecute(request.input, request.context);
      return { [getResponseKey()]: result };
    });
  }

  return agentInstance;
}

/**
 * Create a chat agent from a configuration object.
 *
 * This is a convenience factory that creates an agent with a standard chat
 * interface (messages in, message out).
 *
 * Request: `{ messages: [...] }`
 * Response: `{ message: { role: 'assistant', content: '...' } }`
 *
 * @example
 * ```typescript
 * // Non-streaming chat agent
 * // Request: { messages: [{ role: 'user', content: 'hello' }] }
 * // Response: { message: { role: 'assistant', content: 'You said: hello' } }
 * const bot = chatAgent('bot', {
 *   description: 'A simple chatbot',
 *   execute: async (messages) => {
 *     const lastMsg = messages.at(-1)?.content ?? '';
 *     return { role: 'assistant', content: `You said: ${lastMsg}` };
 *   },
 * });
 *
 * // Streaming chat agent (async generator)
 * const streamingBot = chatAgent('streaming-bot', {
 *   description: 'A streaming chatbot',
 *   execute: async function* (messages) {
 *     yield 'Hello';
 *     yield ' ';
 *     yield 'world!';
 *   },
 * });
 * ```
 */
export function chatAgent(name: string, options: ChatAgentOptions): Agent {
  // Chat agents have default request/response keys (can be overridden via metadata)
  const requestKeys = ['messages'];
  const responseKeys = ['message'];

  // Define standard chat agent schemas
  const parametersSchema = {
    type: 'object',
    properties: {
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['role', 'content'],
        },
      },
    },
    required: ['messages'],
  };

  // Message schema (the value, not the full response)
  const messageSchema = {
    type: 'object',
    properties: {
      role: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['role', 'content'],
  };

  // Wrap message schema to match responseKeys structure
  const wrappedOutput = wrapOutputSchemaForResponseKeys(messageSchema, responseKeys);

  // Build metadata (allow metadata override to change responseKeys)
  const baseMetadata: Record<string, unknown> = {
    type: 'chat_agent',
    description: options.description,
    parameters: parametersSchema,
    requestKeys,
    responseKeys,
  };

  // If metadata override includes responseKeys, re-wrap output schema
  const finalResponseKeys =
    (options.metadata?.responseKeys as string[] | undefined) ?? responseKeys;
  const finalWrappedOutput =
    (options.metadata?.responseKeys as string[] | undefined) !== undefined
      ? wrapOutputSchemaForResponseKeys(messageSchema, finalResponseKeys)
      : wrappedOutput;

  if (finalWrappedOutput !== undefined) {
    baseMetadata.output = finalWrappedOutput;
  }

  const agentInstance = new Agent(name, {
    metadata: {
      ...baseMetadata,
      ...options.metadata,
    },
  });

  // Detect if execute is an async generator function
  const isStreaming = isAsyncGeneratorFunction(options.execute);

  // Get the response key from the agent's metadata (allows custom override)
  const getResponseKey = () => {
    const keys = agentInstance.metadata.responseKeys as string[] | undefined;
    return keys?.[0] ?? 'message';
  };

  if (isStreaming) {
    const streamExecute = options.execute as (
      messages: Message[],
      context?: Record<string, unknown>
    ) => AsyncGenerator<string, void, unknown>;

    // Register streaming execute handler
    agentInstance.onExecuteStream(async function* (request: ExecuteRequest) {
      const rawMessages = (request.input.messages ?? []) as Message[];
      yield* streamExecute(rawMessages, request.context);
    });

    // Also register non-streaming handler that collects chunks
    agentInstance.onExecute(async (request: ExecuteRequest): Promise<Record<string, unknown>> => {
      const rawMessages = (request.input.messages ?? []) as Message[];
      const chunks: string[] = [];
      for await (const chunk of streamExecute(rawMessages, request.context)) {
        chunks.push(chunk);
      }
      return { [getResponseKey()]: { role: 'assistant', content: chunks.join('') } };
    });
  } else {
    const regularExecute = options.execute as (
      messages: Message[],
      context?: Record<string, unknown>
    ) => Promise<Message>;

    agentInstance.onExecute(async (request: ExecuteRequest): Promise<Record<string, unknown>> => {
      const rawMessages = (request.input.messages ?? []) as Message[];
      const message = await regularExecute(rawMessages, request.context);
      return { [getResponseKey()]: message };
    });
  }

  return agentInstance;
}
