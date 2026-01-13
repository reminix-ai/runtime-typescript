/**
 * Base agent and adapter interface.
 */

import type {
  InvokeRequest,
  InvokeResponse,
  ChatRequest,
  ChatResponse,
} from '../types.js';
import { VERSION } from '../version.js';

/**
 * Web-standard fetch handler type.
 */
export type FetchHandler = (request: Request) => Promise<Response>;

/**
 * Metadata returned by agents for discovery.
 */
export interface AgentMetadata {
  type: 'agent' | 'adapter';
  adapter?: string;
  [key: string]: unknown;
}

/**
 * Handler type for invoke requests.
 */
export type InvokeHandler = (request: InvokeRequest) => Promise<InvokeResponse>;

/**
 * Handler type for chat requests.
 */
export type ChatHandler = (request: ChatRequest) => Promise<ChatResponse>;

/**
 * Handler type for streaming invoke requests.
 */
export type InvokeStreamHandler = (
  request: InvokeRequest
) => AsyncGenerator<string, void, unknown>;

/**
 * Handler type for streaming chat requests.
 */
export type ChatStreamHandler = (
  request: ChatRequest
) => AsyncGenerator<string, void, unknown>;

/**
 * Abstract base class defining the agent interface.
 *
 * This is the core contract that all agents must fulfill.
 * Use `Agent` for callback-based registration or extend
 * `BaseAdapter` for framework adapters.
 */
export abstract class AgentBase {
  /**
   * Whether invoke supports streaming. Override to enable.
   */
  get invokeStreaming(): boolean {
    return false;
  }

  /**
   * Whether chat supports streaming. Override to enable.
   */
  get chatStreaming(): boolean {
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
    return { type: 'agent' };
  }

  /**
   * Handle an invoke request.
   */
  abstract invoke(request: InvokeRequest): Promise<InvokeResponse>;

  /**
   * Handle a chat request.
   */
  abstract chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Handle a streaming invoke request.
   */
  async *invokeStream(
    request: InvokeRequest
  ): AsyncGenerator<string, void, unknown> {
    throw new Error('Streaming not implemented for this agent');
  }

  /**
   * Handle a streaming chat request.
   */
  async *chatStream(
    request: ChatRequest
  ): AsyncGenerator<string, void, unknown> {
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
   * agent.onInvoke(async (req) => ({ output: 'Hello!' }));
   * export default agent.toHandler();
   *
   * // Cloudflare Worker
   * export default { fetch: agent.toHandler() };
   * ```
   */
  toHandler(): FetchHandler {
    const agent = this;

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
                  name: agent.name,
                  ...agent.metadata,
                  invoke: { streaming: agent.invokeStreaming },
                  chat: { streaming: agent.chatStreaming },
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
          if (agentName !== agent.name) {
            return Response.json(
              { error: `Agent '${agentName}' not found` },
              { status: 404, headers: corsHeaders }
            );
          }

          const body = (await request.json()) as InvokeRequest;

          if (!body.input || Object.keys(body.input).length === 0) {
            return Response.json(
              { error: 'input is required and must not be empty' },
              { status: 400, headers: corsHeaders }
            );
          }

          // Handle streaming
          if (body.stream) {
            const stream = new ReadableStream({
              async start(controller) {
                const encoder = new TextEncoder();
                try {
                  for await (const chunk of agent.invokeStream(body)) {
                    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : 'Unknown error';
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

          const response = await agent.invoke(body);
          return Response.json(response, { headers: corsHeaders });
        }

        // POST /agents/{name}/chat
        const chatMatch = path.match(/^\/agents\/([^/]+)\/chat$/);
        if (method === 'POST' && chatMatch) {
          const agentName = chatMatch[1];
          if (agentName !== agent.name) {
            return Response.json(
              { error: `Agent '${agentName}' not found` },
              { status: 404, headers: corsHeaders }
            );
          }

          const body = (await request.json()) as ChatRequest;

          if (!body.messages || body.messages.length === 0) {
            return Response.json(
              { error: 'messages is required and must not be empty' },
              { status: 400, headers: corsHeaders }
            );
          }

          // Handle streaming
          if (body.stream) {
            const stream = new ReadableStream({
              async start(controller) {
                const encoder = new TextEncoder();
                try {
                  for await (const chunk of agent.chatStream(body)) {
                    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : 'Unknown error';
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

          const response = await agent.chat(body);
          return Response.json(response, { headers: corsHeaders });
        }

        // Not found
        return Response.json(
          { error: 'Not found' },
          { status: 404, headers: corsHeaders }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return Response.json(
          { error: message },
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
 * agent.onInvoke(async (request) => {
 *   return { output: 'Hello!' };
 * });
 *
 * agent.onChat(async (request) => {
 *   return { output: 'Hi!', messages: [...] };
 * });
 *
 * serve([agent], { port: 8080 });
 * ```
 */
export class Agent extends AgentBase {
  private readonly _name: string;
  private readonly _metadata: Record<string, unknown>;

  private _invokeHandler: InvokeHandler | null = null;
  private _chatHandler: ChatHandler | null = null;
  private _invokeStreamHandler: InvokeStreamHandler | null = null;
  private _chatStreamHandler: ChatStreamHandler | null = null;

  /**
   * Create a new agent.
   *
   * @param name - The agent name (used in URLs like /agents/{name}/invoke)
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
    return { type: 'agent', ...this._metadata };
  }

  /**
   * Whether invoke supports streaming.
   */
  override get invokeStreaming(): boolean {
    return this._invokeStreamHandler !== null;
  }

  /**
   * Whether chat supports streaming.
   */
  override get chatStreaming(): boolean {
    return this._chatStreamHandler !== null;
  }

  /**
   * Register an invoke handler.
   *
   * @example
   * agent.onInvoke(async (request) => {
   *   return { output: 'Hello!' };
   * });
   */
  onInvoke(handler: InvokeHandler): this {
    this._invokeHandler = handler;
    return this;
  }

  /**
   * Register a chat handler.
   *
   * @example
   * agent.onChat(async (request) => {
   *   return { output: 'Hi!', messages: [...] };
   * });
   */
  onChat(handler: ChatHandler): this {
    this._chatHandler = handler;
    return this;
  }

  /**
   * Register a streaming invoke handler.
   *
   * @example
   * agent.onInvokeStream(async function* (request) {
   *   yield '{"chunk": "Hello"}';
   *   yield '{"chunk": " world!"}';
   * });
   */
  onInvokeStream(handler: InvokeStreamHandler): this {
    this._invokeStreamHandler = handler;
    return this;
  }

  /**
   * Register a streaming chat handler.
   *
   * @example
   * agent.onChatStream(async function* (request) {
   *   yield '{"chunk": "Hi"}';
   * });
   */
  onChatStream(handler: ChatStreamHandler): this {
    this._chatStreamHandler = handler;
    return this;
  }

  /**
   * Handle an invoke request.
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    if (this._invokeHandler === null) {
      throw new Error(`No invoke handler registered for agent '${this._name}'`);
    }
    return this._invokeHandler(request);
  }

  /**
   * Handle a chat request.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this._chatHandler === null) {
      throw new Error(`No chat handler registered for agent '${this._name}'`);
    }
    return this._chatHandler(request);
  }

  /**
   * Handle a streaming invoke request.
   */
  async *invokeStream(
    request: InvokeRequest
  ): AsyncGenerator<string, void, unknown> {
    if (this._invokeStreamHandler === null) {
      throw new Error(
        `No streaming invoke handler registered for agent '${this._name}'`
      );
    }
    yield* this._invokeStreamHandler(request);
  }

  /**
   * Handle a streaming chat request.
   */
  async *chatStream(
    request: ChatRequest
  ): AsyncGenerator<string, void, unknown> {
    if (this._chatStreamHandler === null) {
      throw new Error(
        `No streaming chat handler registered for agent '${this._name}'`
      );
    }
    yield* this._chatStreamHandler(request);
  }
}

/**
 * Base class for framework adapters.
 *
 * Extend this class when wrapping an existing AI framework
 * (e.g., LangChain, OpenAI, Anthropic).
 */
export abstract class BaseAdapter extends AgentBase {
  /**
   * The adapter name. Subclasses should override this.
   */
  static adapterName: string = 'unknown';

  /**
   * All built-in adapters support streaming.
   */
  override get invokeStreaming(): boolean {
    return true;
  }

  override get chatStreaming(): boolean {
    return true;
  }

  /**
   * Return adapter metadata for discovery.
   */
  get metadata(): AgentMetadata {
    return {
      type: 'adapter',
      adapter: (this.constructor as typeof BaseAdapter).adapterName,
    };
  }

  /**
   * Handle a streaming invoke request.
   */
  async *invokeStream(
    request: InvokeRequest
  ): AsyncGenerator<string, void, unknown> {
    throw new Error('Streaming not implemented for this adapter');
  }

  /**
   * Handle a streaming chat request.
   */
  async *chatStream(
    request: ChatRequest
  ): AsyncGenerator<string, void, unknown> {
    throw new Error('Streaming not implemented for this adapter');
  }
}
