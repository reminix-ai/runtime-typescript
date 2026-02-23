/**
 * OpenAI chat agent for Reminix Runtime.
 */

import type OpenAI from 'openai';

import {
  Agent,
  AGENT_TYPES,
  messageContentToText,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
  type Message,
} from '@reminix/runtime';

export interface OpenAIChatAgentOptions {
  name?: string;
  model?: string;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class OpenAIChatAgent extends Agent {
  private client: OpenAI;
  private _model: string;

  constructor(client: OpenAI, options: OpenAIChatAgentOptions = {}) {
    super(options.name ?? 'openai-agent', {
      description: options.description ?? 'openai chat agent',
      streaming: true,
      inputSchema: AGENT_TYPES['chat'].inputSchema,
      outputSchema: AGENT_TYPES['chat'].outputSchema,
      type: 'chat',
      framework: 'openai',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.client = client;
    this._model = options.model ?? 'gpt-4o-mini';
  }

  get model(): string {
    return this._model;
  }

  private toOpenAIMessage(message: Message): OpenAI.Chat.ChatCompletionMessageParam {
    const role = message.role === 'developer' ? 'system' : message.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system')
      return { role: 'user', content: messageContentToText(message.content) };
    const result: OpenAI.Chat.ChatCompletionMessageParam = {
      role,
      content: messageContentToText(message.content) || '',
    };
    return result;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const messages = buildMessagesFromInput(request);
    const openaiMessages = messages.map((m) => this.toOpenAIMessage(m));
    if (this.instructions) {
      openaiMessages.unshift({ role: 'system', content: this.instructions });
    }

    const response = await this.client.chat.completions.create({
      model: this._model,
      messages: openaiMessages,
    });

    const output = response.choices[0]?.message?.content ?? '';
    return { output };
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    const messages = buildMessagesFromInput(request);
    const openaiMessages = messages.map((m) => this.toOpenAIMessage(m));
    if (this.instructions) {
      openaiMessages.unshift({ role: 'system', content: this.instructions });
    }

    const stream = await this.client.chat.completions.create({
      model: this._model,
      messages: openaiMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}
