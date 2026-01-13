/**
 * Base agent and adapter interface.
 */

import type {
  InvokeRequest,
  InvokeResponse,
  ChatRequest,
  ChatResponse,
} from '../types.js';

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
