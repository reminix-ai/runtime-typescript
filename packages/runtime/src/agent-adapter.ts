/**
 * Base agent adapter class for framework integrations.
 */

import type { AgentInvokeRequest, JSONSchema } from './types.js';
import { AgentBase, type AgentMetadata } from './agent.js';

/**
 * Adapter input schema - accepts both messages and prompt.
 */
const ADAPTER_INPUT: JSONSchema = {
  type: 'object',
  properties: {
    messages: {
      type: 'array',
      description: 'Chat-style messages input',
    },
    prompt: {
      type: 'string',
      description: 'Simple prompt input',
    },
  },
};

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
   * Return adapter metadata for discovery.
   * Adapters accept both 'messages' (chat-style) and 'prompt' (simple) inputs.
   */
  get metadata(): AgentMetadata {
    return {
      description: `${(this.constructor as typeof AgentAdapter).adapterName} adapter`,
      capabilities: {
        streaming: true,
      },
      input: ADAPTER_INPUT,
      output: { type: 'string' },
      adapter: (this.constructor as typeof AgentAdapter).adapterName,
    };
  }

  /**
   * Handle a streaming invoke request.
   */
  // eslint-disable-next-line require-yield
  async *invokeStream(_request: AgentInvokeRequest): AsyncGenerator<string, void, unknown> {
    throw new Error('Streaming not implemented for this adapter');
  }
}
