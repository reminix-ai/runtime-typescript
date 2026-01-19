/**
 * OpenAI adapter for Reminix Runtime.
 */

import type OpenAI from 'openai';

import {
  AgentAdapter,
  serve,
  type ServeOptions,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Options for wrapping an OpenAI client.
 */
export interface OpenAIAgentAdapterOptions {
  name?: string;
  model?: string;
}

/**
 * Adapter for OpenAI chat completions.
 */
export class OpenAIAgentAdapter extends AgentAdapter {
  static adapterName = 'openai';

  private client: OpenAI;
  private _name: string;
  private _model: string;

  /**
   * Initialize the adapter.
   *
   * @param client - An OpenAI client.
   * @param options - Adapter options.
   */
  constructor(client: OpenAI, options: OpenAIAgentAdapterOptions = {}) {
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
    const result: OpenAI.Chat.ChatCompletionMessageParam = {
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content || '',
    };
    return result;
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
    // Check if input contains messages
    let messages: OpenAI.Chat.ChatCompletionMessageParam[];
    const input = request.input as Record<string, unknown>;

    if ('messages' in input) {
      messages = input.messages as OpenAI.Chat.ChatCompletionMessageParam[];
    } else if ('prompt' in input) {
      messages = [{ role: 'user', content: String(input.prompt) }];
    } else {
      messages = [{ role: 'user', content: JSON.stringify(input) }];
    }

    // Call OpenAI API
    const response = await this.client.chat.completions.create({
      model: this._model,
      messages,
    });

    // Extract content from response
    const output = response.choices[0]?.message?.content ?? '';

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
    // Convert messages to OpenAI format
    const openaiMessages = request.messages.map((m) => this.toOpenAIMessage(m));

    // Call OpenAI API
    const response = await this.client.chat.completions.create({
      model: this._model,
      messages: openaiMessages,
    });

    // Extract content from response
    const output = response.choices[0]?.message?.content ?? '';

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
  async *invokeStream(request: InvokeRequest): AsyncGenerator<string, void, unknown> {
    // Build messages from input
    let messages: OpenAI.Chat.ChatCompletionMessageParam[];
    const input = request.input as Record<string, unknown>;

    if ('messages' in input) {
      messages = input.messages as OpenAI.Chat.ChatCompletionMessageParam[];
    } else if ('prompt' in input) {
      messages = [{ role: 'user', content: String(input.prompt) }];
    } else {
      messages = [{ role: 'user', content: JSON.stringify(input) }];
    }

    // Stream from OpenAI API
    const stream = await this.client.chat.completions.create({
      model: this._model,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield JSON.stringify({ chunk: content });
      }
    }
  }

  /**
   * Handle a streaming chat request.
   *
   * @param request - The chat request with messages.
   * @yields JSON-encoded chunks from the stream.
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    // Convert messages to OpenAI format
    const openaiMessages = request.messages.map((m) => this.toOpenAIMessage(m));

    // Stream from OpenAI API
    const stream = await this.client.chat.completions.create({
      model: this._model,
      messages: openaiMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield JSON.stringify({ chunk: content });
      }
    }
  }
}

/**
 * Wrap an OpenAI client for use with Reminix Runtime.
 *
 * @param client - An OpenAI client.
 * @param options - Adapter options.
 * @returns An OpenAIAgentAdapter instance.
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { wrap } from '@reminix/openai';
 * import { serve } from '@reminix/runtime';
 *
 * const client = new OpenAI();
 * const agent = wrapAgent(client, { name: 'my-agent', model: 'gpt-4o' });
 * serve({ agents: [agent], port: 8080 });
 * ```
 */
export function wrapAgent(
  client: OpenAI,
  options: OpenAIAgentAdapterOptions = {}
): OpenAIAgentAdapter {
  return new OpenAIAgentAdapter(client, options);
}

/**
 * Options for wrapping and serving an OpenAI client.
 */
export interface WrapAndServeOptions extends OpenAIAgentAdapterOptions, ServeOptions {}

/**
 * Wrap an OpenAI client and serve it immediately.
 *
 * This is a convenience function that combines `wrapAgent` and `serve` for single-agent setups.
 *
 * @param client - An OpenAI client.
 * @param options - Combined adapter and server options.
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { serveAgent } from '@reminix/openai';
 *
 * const client = new OpenAI();
 * serveAgent(client, { name: 'my-agent', model: 'gpt-4o', port: 8080 });
 * ```
 */
export function serveAgent(client: OpenAI, options: WrapAndServeOptions = {}): void {
  const { port, hostname, ...adapterOptions } = options;
  const agent = wrapAgent(client, adapterOptions);
  serve({ agents: [agent], port, hostname });
}
