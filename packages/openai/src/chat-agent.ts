/**
 * OpenAI chat agent for Reminix Runtime.
 */

import type OpenAI from 'openai';

import {
  AGENT_TYPES,
  messageContentToText,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
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

export class OpenAIChatAgent {
  private client: OpenAI;
  private _name: string;
  private _model: string;
  private _description: string;
  private _instructions: string | undefined;
  private _tags: string[] | undefined;
  private _extraMetadata: Record<string, unknown> | undefined;

  constructor(client: OpenAI, options: OpenAIChatAgentOptions = {}) {
    this.client = client;
    this._name = options.name ?? 'openai-agent';
    this._model = options.model ?? 'gpt-4o-mini';
    this._description = options.description ?? 'openai chat agent';
    this._instructions = options.instructions;
    this._tags = options.tags;
    this._extraMetadata = options.metadata;
  }

  get name(): string {
    return this._name;
  }

  get model(): string {
    return this._model;
  }

  get metadata(): AgentMetadata {
    const result: AgentMetadata = {
      description: this._description,
      capabilities: { streaming: true },
      input: AGENT_TYPES['chat'].input,
      output: AGENT_TYPES['chat'].output,
      framework: 'openai',
      type: 'chat',
    };
    if (this._tags) {
      result.tags = this._tags;
    }
    if (this._extraMetadata) {
      Object.assign(result, this._extraMetadata);
    }
    return result;
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
    if (this._instructions) {
      openaiMessages.unshift({ role: 'system', content: this._instructions });
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
    if (this._instructions) {
      openaiMessages.unshift({ role: 'system', content: this._instructions });
    }

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
