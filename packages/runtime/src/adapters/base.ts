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
 * Base class for all agents.
 */
export abstract class Agent {
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
 * Base class for framework adapters.
 *
 * Extend this class when wrapping an existing AI framework
 * (e.g., LangChain, OpenAI, Anthropic).
 */
export abstract class BaseAdapter extends Agent {
  /**
   * The adapter name. Subclasses should override this.
   */
  static adapterName: string = 'unknown';

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
