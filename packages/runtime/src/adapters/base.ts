/**
 * Base adapter interface that all framework adapters must implement.
 */

import type {
  InvokeRequest,
  InvokeResponse,
  ChatRequest,
  ChatResponse,
} from '../types.js';

export abstract class BaseAdapter {
  /**
   * Return the agent name.
   */
  abstract get name(): string;

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
