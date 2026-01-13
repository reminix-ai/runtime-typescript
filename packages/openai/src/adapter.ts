/**
 * OpenAI adapter for Reminix Runtime.
 */

import type OpenAI from 'openai';

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Options for wrapping an OpenAI client.
 */
export interface OpenAIAdapterOptions {
  name?: string;
  model?: string;
}

/**
 * Adapter for OpenAI chat completions.
 */
export class OpenAIAdapter extends BaseAdapter {
  private client: OpenAI;
  private _name: string;
  private _model: string;

  /**
   * Initialize the adapter.
   *
   * @param client - An OpenAI client.
   * @param options - Adapter options.
   */
  constructor(client: OpenAI, options: OpenAIAdapterOptions = {}) {
    super();
    this.client = client;
    this._name = options.name ?? 'openai-agent';
    this._model = options.model ?? 'gpt-4o-mini';
  }

  get name(): string {
    return this._name;
  }

  get model(): string {
    return this._model;
  }

  /**
   * Convert a Reminix message to OpenAI format.
   */
  private toOpenAIMessage(message: Message): OpenAI.Chat.ChatCompletionMessageParam {
    return {
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content,
    };
  }

  /**
   * Handle an invoke request.
   *
   * @param request - The invoke request with messages.
   * @returns The invoke response with the assistant's reply.
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    // Convert messages to OpenAI format
    const openaiMessages = request.messages.map((m) => this.toOpenAIMessage(m));

    // Call OpenAI API
    const response = await this.client.chat.completions.create({
      model: this._model,
      messages: openaiMessages,
    });

    // Extract content from response
    const content = response.choices[0]?.message?.content ?? '';

    // Build response messages (original + assistant response)
    const responseMessages: Message[] = [
      ...request.messages,
      { role: 'assistant', content },
    ];

    return { content, messages: responseMessages };
  }

  /**
   * Handle a chat request.
   *
   * @param request - The chat request with messages.
   * @returns The chat response with the assistant's reply.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Convert messages to OpenAI format
    const openaiMessages = request.messages.map((m) => this.toOpenAIMessage(m));

    // Call OpenAI API
    const response = await this.client.chat.completions.create({
      model: this._model,
      messages: openaiMessages,
    });

    // Extract content from response
    const content = response.choices[0]?.message?.content ?? '';

    // Build response messages (original + assistant response)
    const responseMessages: Message[] = [
      ...request.messages,
      { role: 'assistant', content },
    ];

    return { content, messages: responseMessages };
  }
}

/**
 * Wrap an OpenAI client for use with Reminix Runtime.
 *
 * @param client - An OpenAI client.
 * @param options - Adapter options.
 * @returns An OpenAIAdapter instance.
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { wrap } from '@reminix/openai';
 * import { serve } from '@reminix/runtime';
 *
 * const client = new OpenAI();
 * const agent = wrap(client, { name: 'my-agent', model: 'gpt-4o' });
 * serve([agent], { port: 8080 });
 * ```
 */
export function wrap(
  client: OpenAI,
  options: OpenAIAdapterOptions = {}
): OpenAIAdapter {
  return new OpenAIAdapter(client, options);
}
