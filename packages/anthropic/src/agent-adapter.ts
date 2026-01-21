/**
 * Anthropic adapter for Reminix Runtime.
 */

import type Anthropic from '@anthropic-ai/sdk';

import {
  AgentAdapter,
  serve,
  type ServeOptions,
  type ExecuteRequest,
  type ExecuteResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Options for wrapping an Anthropic client.
 */
export interface AnthropicAgentAdapterOptions {
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
export class AnthropicAgentAdapter extends AgentAdapter {
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
  constructor(client: Anthropic, options: AnthropicAgentAdapterOptions = {}) {
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
  private extractSystemAndMessages(messages: Message[]): {
    system: string | undefined;
    messages: AnthropicMessage[];
  } {
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
   * Build Message list from execute request input.
   */
  private buildMessagesFromInput(request: ExecuteRequest): Message[] {
    const input = request.input as Record<string, unknown>;

    if ('messages' in input) {
      return input.messages as Message[];
    } else if ('prompt' in input) {
      return [{ role: 'user', content: String(input.prompt) }];
    } else {
      return [{ role: 'user', content: JSON.stringify(input) }];
    }
  }

  /**
   * Handle an execute request.
   *
   * For both task-oriented and chat-style operations. Expects input with 'messages' key
   * or a 'prompt' key for simple text generation.
   *
   * @param request - The execute request with input data.
   * @returns The execute response with the output.
   */
  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    const messages = this.buildMessagesFromInput(request);

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
   * Handle a streaming execute request.
   *
   * @param request - The execute request with input data.
   * @yields JSON-encoded chunks from the stream.
   */
  async *executeStream(request: ExecuteRequest): AsyncGenerator<string, void, unknown> {
    const messages = this.buildMessagesFromInput(request);

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
}

/**
 * Wrap an Anthropic client for use with Reminix Runtime.
 *
 * @param client - An Anthropic client.
 * @param options - Adapter options.
 * @returns An AnthropicAgentAdapter instance.
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { wrap } from '@reminix/anthropic';
 * import { serve } from '@reminix/runtime';
 *
 * const client = new Anthropic();
 * const agent = wrapAgent(client, { name: 'my-agent', model: 'claude-sonnet-4-20250514' });
 * serve({ agents: [agent], port: 8080 });
 * ```
 */
export function wrapAgent(
  client: Anthropic,
  options: AnthropicAgentAdapterOptions = {}
): AnthropicAgentAdapter {
  return new AnthropicAgentAdapter(client, options);
}

/**
 * Options for wrapping and serving an Anthropic client.
 */
export interface WrapAndServeOptions extends AnthropicAgentAdapterOptions, ServeOptions {}

/**
 * Wrap an Anthropic client and serve it immediately.
 *
 * This is a convenience function that combines `wrapAgent` and `serve` for single-agent setups.
 *
 * @param client - An Anthropic client.
 * @param options - Combined adapter and server options.
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { serveAgent } from '@reminix/anthropic';
 *
 * const client = new Anthropic();
 * serveAgent(client, { name: 'my-agent', model: 'claude-sonnet-4-20250514', port: 8080 });
 * ```
 */
export function serveAgent(client: Anthropic, options: WrapAndServeOptions = {}): void {
  const { port, hostname, ...adapterOptions } = options;
  const agent = wrapAgent(client, adapterOptions);
  serve({ agents: [agent], port, hostname });
}
