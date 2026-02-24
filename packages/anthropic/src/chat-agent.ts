/**
 * Anthropic chat agent for Reminix Runtime.
 */

import type Anthropic from '@anthropic-ai/sdk';

import {
  Agent,
  AGENT_TYPES,
  messageContentToText,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
  type Message,
} from '@reminix/runtime';

export interface AnthropicChatAgentOptions {
  name?: string;
  model?: string;
  maxTokens?: number;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
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

  private extractSystemAndMessages(messages: Message[]): {
    system: string | undefined;
    messages: AnthropicMessage[];
  } {
    let system: string | undefined;
    const anthropicMessages: AnthropicMessage[] = [];

    for (const message of messages) {
      const text = messageContentToText(message.content);
      if (message.role === 'system') {
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
    const { system, messages: anthropicMessages } = this.extractSystemAndMessages(messages);
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
