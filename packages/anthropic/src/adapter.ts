/**
 * Anthropic adapter for Reminix Runtime.
 */

import type Anthropic from '@anthropic-ai/sdk';

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Options for wrapping an Anthropic client.
 */
export interface AnthropicAdapterOptions {
  name?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Anthropic message parameter type.
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Adapter for Anthropic messages API.
 */
export class AnthropicAdapter extends BaseAdapter {
  static adapterName = 'anthropic';

  private client: Anthropic;
  private _name: string;
  private _model: string;
  private _maxTokens: number;

  /**
   * Initialize the adapter.
   *
   * @param client - An Anthropic client.
   * @param options - Adapter options.
   */
  constructor(client: Anthropic, options: AnthropicAdapterOptions = {}) {
    super();
    this.client = client;
    this._name = options.name ?? 'anthropic-agent';
    this._model = options.model ?? 'claude-sonnet-4-20250514';
    this._maxTokens = options.maxTokens ?? 4096;
  }

  get name(): string {
    return this._name;
  }

  get model(): string {
    return this._model;
  }

  /**
   * Extract system message and convert remaining messages to Anthropic format.
   */
  private extractSystemAndMessages(
    messages: Message[]
  ): { system: string | undefined; messages: AnthropicMessage[] } {
    let system: string | undefined;
    const anthropicMessages: AnthropicMessage[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Anthropic only supports one system message, use the last one
        system = message.content || '';
      } else {
        anthropicMessages.push({
          role: message.role as 'user' | 'assistant',
          content: message.content || '',
        });
      }
    }

    return { system, messages: anthropicMessages };
  }

  /**
   * Extract text content from Anthropic response.
   */
  private extractContent(response: Anthropic.Message): string {
    for (const block of response.content) {
      if (block.type === 'text') {
        return block.text;
      }
    }
    return '';
  }

  /**
   * Handle an invoke request.
   *
   * For task-oriented operations. Expects input with 'messages' key
   * or a 'prompt' key for simple text generation.
   *
   * @param request - The invoke request with input data.
   * @returns The invoke response with the output.
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    const input = request.input as Record<string, unknown>;
    
    // Build messages from input
    let messages: Message[];
    if ('messages' in input) {
      messages = input.messages as Message[];
    } else if ('prompt' in input) {
      messages = [{ role: 'user', content: String(input.prompt) }];
    } else {
      messages = [{ role: 'user', content: JSON.stringify(input) }];
    }

    // Extract system message and convert messages
    const { system, messages: anthropicMessages } = this.extractSystemAndMessages(messages);

    // Call Anthropic API
    const response = await this.client.messages.create({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: anthropicMessages,
      ...(system && { system }),
    });

    // Extract content from response
    const output = this.extractContent(response);

    return { output };
  }

  /**
   * Handle a chat request.
   *
   * For conversational interactions.
   *
   * @param request - The chat request with messages.
   * @returns The chat response with output and messages.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Extract system message and convert messages
    const { system, messages: anthropicMessages } = this.extractSystemAndMessages(
      request.messages
    );

    // Call Anthropic API
    const response = await this.client.messages.create({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: anthropicMessages,
      ...(system && { system }),
    });

    // Extract content from response
    const output = this.extractContent(response);

    // Build response messages (original + assistant response)
    const responseMessages: Message[] = [
      ...request.messages,
      { role: 'assistant', content: output },
    ];

    return { output, messages: responseMessages };
  }

  /**
   * Handle a streaming invoke request.
   *
   * @param request - The invoke request with input data.
   * @yields JSON-encoded chunks from the stream.
   */
  async *invokeStream(
    request: InvokeRequest
  ): AsyncGenerator<string, void, unknown> {
    const input = request.input as Record<string, unknown>;

    // Build messages from input
    let messages: Message[];
    if ('messages' in input) {
      messages = input.messages as Message[];
    } else if ('prompt' in input) {
      messages = [{ role: 'user', content: String(input.prompt) }];
    } else {
      messages = [{ role: 'user', content: JSON.stringify(input) }];
    }

    // Extract system message and convert messages
    const { system, messages: anthropicMessages } = this.extractSystemAndMessages(messages);

    // Stream from Anthropic API
    const stream = this.client.messages.stream({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: anthropicMessages,
      ...(system && { system }),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield JSON.stringify({ chunk: event.delta.text });
      }
    }
  }

  /**
   * Handle a streaming chat request.
   *
   * @param request - The chat request with messages.
   * @yields JSON-encoded chunks from the stream.
   */
  async *chatStream(
    request: ChatRequest
  ): AsyncGenerator<string, void, unknown> {
    // Extract system message and convert messages
    const { system, messages: anthropicMessages } = this.extractSystemAndMessages(
      request.messages
    );

    // Stream from Anthropic API
    const stream = this.client.messages.stream({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: anthropicMessages,
      ...(system && { system }),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield JSON.stringify({ chunk: event.delta.text });
      }
    }
  }
}

/**
 * Wrap an Anthropic client for use with Reminix Runtime.
 *
 * @param client - An Anthropic client.
 * @param options - Adapter options.
 * @returns An AnthropicAdapter instance.
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { wrap } from '@reminix/anthropic';
 * import { serve } from '@reminix/runtime';
 *
 * const client = new Anthropic();
 * const agent = wrap(client, { name: 'my-agent', model: 'claude-sonnet-4-20250514' });
 * serve([agent], { port: 8080 });
 * ```
 */
export function wrap(
  client: Anthropic,
  options: AnthropicAdapterOptions = {}
): AnthropicAdapter {
  return new AnthropicAdapter(client, options);
}
