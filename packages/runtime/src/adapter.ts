/**
 * Base adapter class for framework integrations.
 */

import type { InvokeRequest, ChatRequest } from './types.js';
import { AgentBase, type AgentMetadata } from './agent.js';

/**
 * Base class for framework adapters.
 *
 * Extend this class when wrapping an existing AI framework
 * (e.g., LangChain, OpenAI, Anthropic).
 */
export abstract class AdapterBase extends AgentBase {
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
      adapter: (this.constructor as typeof AdapterBase).adapterName,
    };
  }

  /**
   * Handle a streaming invoke request.
   */
  // eslint-disable-next-line require-yield
  async *invokeStream(_request: InvokeRequest): AsyncGenerator<string, void, unknown> {
    throw new Error('Streaming not implemented for this adapter');
  }

  /**
   * Handle a streaming chat request.
   */
  // eslint-disable-next-line require-yield
  async *chatStream(_request: ChatRequest): AsyncGenerator<string, void, unknown> {
    throw new Error('Streaming not implemented for this adapter');
  }
}
