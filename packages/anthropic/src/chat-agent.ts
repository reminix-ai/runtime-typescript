/**
 * Anthropic chat agent for Reminix Runtime.
 */

import type Anthropic from '@anthropic-ai/sdk';

import {
  Agent,
  AGENT_TYPES,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
} from '@reminix/runtime';

import { toAnthropicMessages } from './message-utils.js';

export interface AnthropicChatAgentOptions {
  name?: string;
  model?: string;
  maxTokens?: number;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class AnthropicChatAgent extends Agent {
  private client: Anthropic;
  private _model: string;
  private _maxTokens: number;

  constructor(client: Anthropic, options: AnthropicChatAgentOptions = {}) {
    super(options.name ?? 'anthropic-agent', {
      description: options.description ?? 'anthropic chat agent',
      streaming: true,
      inputSchema: AGENT_TYPES['chat'].inputSchema,
      outputSchema: AGENT_TYPES['chat'].outputSchema,
      type: 'chat',
      framework: 'anthropic',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.client = client;
    this._model = options.model ?? 'claude-sonnet-4-5-20250929';
    this._maxTokens = options.maxTokens ?? 4096;
  }

  get model(): string {
    return this._model;
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
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const effectiveSystem = this.instructions
      ? system
        ? this.instructions + '\n\n' + system
        : this.instructions
      : system;

    const response = await this.client.messages.create({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: anthropicMessages,
      ...(effectiveSystem && { system: effectiveSystem }),
    });

    const output = this.extractContent(response);
    return { output };
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    const messages = buildMessagesFromInput(request);
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const effectiveSystem = this.instructions
      ? system
        ? this.instructions + '\n\n' + system
        : this.instructions
      : system;

    const stream = this.client.messages.stream({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: anthropicMessages,
      ...(effectiveSystem && { system: effectiveSystem }),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}
