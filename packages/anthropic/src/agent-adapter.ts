/**
 * Anthropic adapter for Reminix Runtime.
 */

import type Anthropic from '@anthropic-ai/sdk';

import {
  ADAPTER_INPUT,
  serve,
  messageContentToText,
  buildMessagesFromInput,
  type ServeOptions,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
  type Message,
} from '@reminix/runtime';

export interface AnthropicAgentAdapterOptions {
  name?: string;
  model?: string;
  maxTokens?: number;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AnthropicAgentAdapter {
  private client: Anthropic;
  private _name: string;
  private _model: string;
  private _maxTokens: number;

  constructor(client: Anthropic, options: AnthropicAgentAdapterOptions = {}) {
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

  get metadata(): AgentMetadata {
    return {
      description: 'anthropic adapter',
      capabilities: { streaming: true },
      input: ADAPTER_INPUT,
      output: { type: 'string' },
      adapter: 'anthropic',
    };
  }

  private extractSystemAndMessages(messages: Message[]): {
    system: string | undefined;
    messages: AnthropicMessage[];
  } {
    let system: string | undefined;
    const anthropicMessages: AnthropicMessage[] = [];

    for (const message of messages) {
      const text = messageContentToText(message.content);
      if (message.role === 'system' || message.role === 'developer') {
        system = text;
      } else if (message.role === 'user' || message.role === 'assistant') {
        anthropicMessages.push({ role: message.role, content: text });
      }
    }

    return { system, messages: anthropicMessages };
  }

  private extractContent(response: Anthropic.Message): string {
    for (const block of response.content) {
      if (block.type === 'text') {
        return block.text;
      }
    }
    return '';
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const messages = buildMessagesFromInput(request);
    const { system, messages: anthropicMessages } = this.extractSystemAndMessages(messages);

    const response = await this.client.messages.create({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: anthropicMessages,
      ...(system && { system }),
    });

    const output = this.extractContent(response);
    return { output };
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    const messages = buildMessagesFromInput(request);
    const { system, messages: anthropicMessages } = this.extractSystemAndMessages(messages);

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

export function wrapAgent(
  client: Anthropic,
  options: AnthropicAgentAdapterOptions = {}
): AnthropicAgentAdapter {
  return new AnthropicAgentAdapter(client, options);
}

export interface WrapAndServeOptions extends AnthropicAgentAdapterOptions, ServeOptions {}

export function serveAgent(client: Anthropic, options: WrapAndServeOptions = {}): void {
  const { port, hostname, ...adapterOptions } = options;
  const agent = wrapAgent(client, adapterOptions);
  serve({ agents: [agent], port, hostname });
}
