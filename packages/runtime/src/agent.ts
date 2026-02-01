/**
 * Agent classes for Reminix Runtime.
 */

import type { AgentInvokeRequest, AgentInvokeResponse, JSONSchema, Capabilities } from './types.js';
import { VERSION } from './version.js';

/**
 * Named agent templates with predefined input/output schemas.
 * The default template is 'prompt'; use it when no template or input/output is provided.
 */
export type AgentTemplate = 'prompt' | 'chat' | 'task' | 'rag' | 'thread';

/** Default template when none specified and no custom input/output. */
const DEFAULT_AGENT_TEMPLATE: AgentTemplate = 'prompt';

/** JSON schema for a single tool call (OpenAI-style). */
const TOOL_CALL_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Tool call id' },
    type: { type: 'string', enum: ['function'], description: 'Tool call type' },
    function: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Function/tool name' },
        arguments: { type: 'string', description: 'JSON string of arguments' },
      },
      required: ['name', 'arguments'],
    },
  },
  required: ['id', 'type', 'function'],
};

/** Content part schema (text, image_url, input_audio, file, refusal). */
const CONTENT_PART_SCHEMA: JSONSchema = {
  oneOf: [
    {
      type: 'object',
      properties: { type: { const: 'text' }, text: { type: 'string' } },
      required: ['type', 'text'],
    },
    {
      type: 'object',
      properties: {
        type: { const: 'image_url' },
        image_url: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            detail: { type: 'string', enum: ['auto', 'low', 'high'] },
          },
          required: ['url'],
        },
      },
      required: ['type', 'image_url'],
    },
    {
      type: 'object',
      properties: {
        type: { const: 'input_audio' },
        input_audio: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'Base64 encoded audio data' },
            format: { type: 'string', enum: ['wav', 'mp3'] },
          },
          required: ['data', 'format'],
        },
      },
      required: ['type', 'input_audio'],
    },
    {
      type: 'object',
      properties: {
        type: { const: 'file' },
        file: {
          type: 'object',
          properties: {
            file_id: { type: 'string' },
            filename: { type: 'string' },
            file_data: { type: 'string', description: 'Base64 encoded file data' },
          },
        },
      },
      required: ['type', 'file'],
    },
    {
      type: 'object',
      properties: { type: { const: 'refusal' }, refusal: { type: 'string' } },
      required: ['type', 'refusal'],
    },
  ],
};

/** JSON schema for a message (OpenAI-style; input and output). */
const MESSAGE_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    role: {
      type: 'string',
      enum: ['developer', 'system', 'user', 'assistant', 'tool'],
      description: 'Message role',
    },
    content: {
      oneOf: [
        { type: 'string' },
        { type: 'array', items: CONTENT_PART_SCHEMA, minItems: 1 },
        { type: 'null' },
      ],
      description: 'Message content: string, array of content parts, or null when tool_calls present',
    },
    name: { type: 'string', description: 'Optional participant name' },
    tool_call_id: {
      type: 'string',
      description: 'Tool call ID (required when role is "tool")',
    },
    tool_calls: {
      type: 'array',
      description: 'Tool calls (assistant role only)',
      items: TOOL_CALL_SCHEMA,
    },
  },
};

const AGENT_TEMPLATES: Record<AgentTemplate, { input: JSONSchema; output: JSONSchema }> = {
  prompt: {
    input: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt or task for the agent' },
      },
      required: ['prompt'],
    },
    output: { type: 'string' },
  },
  chat: {
    input: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          description: 'Chat messages (OpenAI-style)',
          items: MESSAGE_SCHEMA,
        },
      },
      required: ['messages'],
    },
    output: { type: 'string' },
  },
  task: {
    input: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task name or description' },
      },
      required: ['task'],
      additionalProperties: true,
    },
    output: {
      description: 'Structured JSON result (object, array, string, number, boolean, or null)',
      type: 'object',
      additionalProperties: true,
    },
  },
  rag: {
    input: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The question to answer from documents' },
        messages: {
          type: 'array',
          description: 'Optional prior conversation (chat-style RAG)',
          items: MESSAGE_SCHEMA,
        },
        collectionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional knowledge collection IDs to scope the search',
        },
      },
      required: ['query'],
    },
    output: { type: 'string' },
  },
  thread: {
    input: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          description: 'Chat messages with tool_calls and tool results (OpenAI-style)',
          items: MESSAGE_SCHEMA,
        },
      },
      required: ['messages'],
    },
    output: {
      type: 'array',
      description:
        'Updated message thread (OpenAI-style, may include assistant message and tool_calls)',
      items: MESSAGE_SCHEMA,
    },
  },
};

/** Default input/output schemas (same as prompt template). Used by AgentBase and custom agents. */
const DEFAULT_AGENT_INPUT = AGENT_TEMPLATES[DEFAULT_AGENT_TEMPLATE].input;
const DEFAULT_AGENT_OUTPUT = AGENT_TEMPLATES[DEFAULT_AGENT_TEMPLATE].output;

/**
 * Web-standard fetch handler type.
 */
export type FetchHandler = (request: Request) => Promise<Response>;

/**
 * Metadata returned by agents for discovery.
 */
export interface AgentMetadata {
  description?: string;
  capabilities: Capabilities;
  input: JSONSchema;
  output?: JSONSchema;
  /** Named template (prompt, chat, task, rag, thread) when agent uses a template. */
  template?: AgentTemplate;
  [key: string]: unknown;
}

/**
 * Handler type for invoke requests.
 */
export type InvokeHandler = (request: AgentInvokeRequest) => Promise<AgentInvokeResponse>;

/**
 * Handler type for streaming invoke requests.
 */
export type InvokeStreamHandler = (
  request: AgentInvokeRequest
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
   * Return the agent name.
   */
  abstract get name(): string;

  /**
   * Return agent metadata for discovery.
   * Override this to provide custom metadata.
   */
  get metadata(): AgentMetadata {
    return {
      capabilities: { streaming: false },
      input: DEFAULT_AGENT_INPUT,
      output: DEFAULT_AGENT_OUTPUT,
    };
  }

  /**
   * Handle an invoke request.
   */
  abstract invoke(request: AgentInvokeRequest): Promise<AgentInvokeResponse>;

  /**
   * Handle a streaming invoke request.
   */
  // eslint-disable-next-line require-yield
  async *invokeStream(_request: AgentInvokeRequest): AsyncGenerator<string, void, unknown> {
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
   * agent.handler(async (req) => ({ output: 'Hello!' }));
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
                },
              ],
            },
            { headers: corsHeaders }
          );
        }

        // POST /agents/{name}/invoke
        const invokeMatch = path.match(/^\/agents\/([^/]+)\/invoke$/);
        if (method === 'POST' && invokeMatch) {
          const agentName = invokeMatch[1];
          if (agentName !== this.name) {
            return Response.json(
              { error: { type: 'NotFoundError', message: `Agent '${agentName}' not found` } },
              { status: 404, headers: corsHeaders }
            );
          }

          const body = (await request.json()) as AgentInvokeRequest;

          const invokeRequest: AgentInvokeRequest = {
            input: body.input ?? {},
            stream: body.stream === true,
            context: body.context,
          };

          // Handle streaming
          if (invokeRequest.stream) {
            const stream = new ReadableStream({
              start: async (controller) => {
                const encoder = new TextEncoder();
                try {
                  for await (const chunk of this.invokeStream(invokeRequest)) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`)
                    );
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Unknown error';
                  const errorType =
                    error instanceof Error ? error.constructor.name : 'ExecutionError';
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ error: { type: errorType, message } })}\n\n`
                    )
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

          const response = await this.invoke(invokeRequest);
          return Response.json(response, { headers: corsHeaders });
        }

        // Not found
        return Response.json(
          { error: { type: 'NotFoundError', message: 'Not found' } },
          { status: 404, headers: corsHeaders }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const errorType = error instanceof Error ? error.constructor.name : 'ExecutionError';
        return Response.json(
          { error: { type: errorType, message } },
          { status: 500, headers: corsHeaders }
        );
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
 * agent.handler(async (request) => {
 *   return { output: 'Hello!' };
 * });
 *
 * serve({ agents: [agent], port: 8080 });
 * ```
 */
export class Agent extends AgentBase {
  private readonly _name: string;
  private readonly _metadata: Partial<AgentMetadata>;

  private _invokeHandler: InvokeHandler | null = null;
  private _invokeStreamHandler: InvokeStreamHandler | null = null;

  /**
   * Create a new agent.
   *
   * @param name - The agent name (used in URLs like /agents/{name}/invoke)
   * @param options - Optional configuration
   */
  constructor(name: string, options?: { metadata?: Partial<AgentMetadata> }) {
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
      capabilities: {
        streaming: this._invokeStreamHandler !== null,
        ...this._metadata.capabilities,
      },
      input: this._metadata.input ?? DEFAULT_AGENT_INPUT,
      output: this._metadata.output ?? DEFAULT_AGENT_OUTPUT,
      ...this._metadata,
    };
  }

  /**
   * Register a handler.
   *
   * @example
   * agent.handler(async (request) => {
   *   return { output: 'Hello!' };
   * });
   */
  handler(fn: InvokeHandler): this {
    this._invokeHandler = fn;
    return this;
  }

  /**
   * Register a streaming handler.
   *
   * @example
   * agent.streamHandler(async function* (request) {
   *   yield 'Hello';
   *   yield ' world!';
   * });
   */
  streamHandler(fn: InvokeStreamHandler): this {
    this._invokeStreamHandler = fn;
    return this;
  }

  /**
   * Handle an invoke request.
   */
  async invoke(request: AgentInvokeRequest): Promise<AgentInvokeResponse> {
    if (this._invokeHandler === null) {
      throw new Error(`No invoke handler registered for agent '${this._name}'`);
    }
    return this._invokeHandler(request);
  }

  /**
   * Handle a streaming invoke request.
   */
  async *invokeStream(request: AgentInvokeRequest): AsyncGenerator<string, void, unknown> {
    if (this._invokeStreamHandler === null) {
      throw new Error(`No streaming invoke handler registered for agent '${this._name}'`);
    }
    yield* this._invokeStreamHandler(request);
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
  /**
   * Named template (prompt, chat, task). When set, input/output default to the template's schemas
   * unless overridden by explicit input/output.
   */
  template?: AgentTemplate;
  /**
   * JSON Schema for input.
   * Defaults to template schema if template is set, else { prompt: string }.
   */
  input?: JSONSchema;
  /** JSON Schema for output. Defaults to template schema if set, else string. */
  output?: JSONSchema;
  /**
   * Handler function - can be a regular async function or an async generator for streaming.
   *
   * Regular function: Returns output directly
   * Async generator: Yields string chunks (automatically collected for non-streaming requests)
   */
  handler:
    | ((input: Record<string, unknown>, context?: Record<string, unknown>) => Promise<unknown>)
    | ((
        input: Record<string, unknown>,
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
 * Create an agent from a configuration object.
 *
 * By default, agents expect `{ input: { prompt: string } }` in the request body and
 * return `{ output: string }`. You can customize by providing `input` schema.
 *
 * @example
 * ```typescript
 * // Simple agent with default input/output
 * // Request: { input: { prompt: 'Hello world' } }
 * // Response: { output: 'You said: Hello world' }
 * const echo = agent('echo', {
 *   description: 'Echo the prompt',
 *   handler: async ({ prompt }) => `You said: ${prompt}`,
 * });
 *
 * // Agent with custom input schema
 * // Request: { input: { a: 1, b: 2 } }
 * // Response: { output: 3 }
 * const calculator = agent('calculator', {
 *   description: 'Add two numbers',
 *   input: {
 *     type: 'object',
 *     properties: { a: { type: 'number' }, b: { type: 'number' } },
 *     required: ['a', 'b'],
 *   },
 *   output: { type: 'number' },
 *   handler: async ({ a, b }) => (a as number) + (b as number),
 * });
 *
 * // Streaming agent (async generator)
 * // Request: { input: { prompt: 'hello world' }, stream: true }
 * const streamer = agent('streamer', {
 *   description: 'Stream text word by word',
 *   handler: async function* ({ prompt }) {
 *     for (const word of (prompt as string).split(' ')) {
 *       yield word + ' ';
 *     }
 *   },
 * });
 * ```
 */
export function agent(name: string, options: AgentOptions): Agent {
  // Default template is 'prompt' when no template and no custom input/output
  const effectiveTemplate: AgentTemplate | undefined =
    options.template ??
    (options.input === undefined && options.output === undefined
      ? DEFAULT_AGENT_TEMPLATE
      : undefined);

  const inputSchema =
    options.input ??
    (effectiveTemplate ? AGENT_TEMPLATES[effectiveTemplate].input : DEFAULT_AGENT_INPUT);
  const outputSchema =
    options.output ??
    (effectiveTemplate ? AGENT_TEMPLATES[effectiveTemplate].output : DEFAULT_AGENT_OUTPUT);

  const agentInstance = new Agent(name, {
    metadata: {
      description: options.description,
      input: inputSchema,
      output: outputSchema,
      ...(effectiveTemplate !== undefined && { template: effectiveTemplate }),
    },
  });

  // Detect if handler is an async generator function
  const isStreaming = isAsyncGeneratorFunction(options.handler);

  if (isStreaming) {
    const streamFn = options.handler as (
      input: Record<string, unknown>,
      context?: Record<string, unknown>
    ) => AsyncGenerator<string, void, unknown>;

    // Register streaming handler
    agentInstance.streamHandler(async function* (request: AgentInvokeRequest) {
      yield* streamFn(request.input, request.context);
    });

    // Also register non-streaming handler that collects chunks
    agentInstance.handler(async (request: AgentInvokeRequest): Promise<AgentInvokeResponse> => {
      const chunks: string[] = [];
      for await (const chunk of streamFn(request.input, request.context)) {
        chunks.push(chunk);
      }
      return { output: chunks.join('') };
    });
  } else {
    const regularHandler = options.handler as (
      input: Record<string, unknown>,
      context?: Record<string, unknown>
    ) => Promise<unknown>;

    agentInstance.handler(async (request: AgentInvokeRequest): Promise<AgentInvokeResponse> => {
      const result = await regularHandler(request.input, request.context);
      return { output: result };
    });
  }

  return agentInstance;
}
