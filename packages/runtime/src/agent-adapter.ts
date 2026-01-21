/**
 * Base agent adapter class for framework integrations.
 */

import type { ExecuteRequest } from './types.js';
import { AgentBase, type AgentMetadata } from './agent.js';

/**
 * Base class for framework agent adapters.
 *
 * Extend this class when wrapping an existing AI framework's agent
 * (e.g., LangChain, OpenAI, Anthropic).
 */
export abstract class AgentAdapter extends AgentBase {
  /**
   * The adapter name. Subclasses should override this.
   */
  static adapterName: string = 'unknown';

  /**
   * All built-in adapters support streaming.
   */
  override get streaming(): boolean {
    return true;
  }

  /**
   * Return adapter metadata for discovery.
   */
  get metadata(): AgentMetadata {
    return {
      type: 'adapter',
      adapter: (this.constructor as typeof AgentAdapter).adapterName,
    };
  }

  /**
   * Handle a streaming execute request.
   */
  // eslint-disable-next-line require-yield
  async *executeStream(_request: ExecuteRequest): AsyncGenerator<string, void, unknown> {
    throw new Error('Streaming not implemented for this adapter');
  }
}
