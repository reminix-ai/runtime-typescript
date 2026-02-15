/**
 * OpenAI adapter for Reminix Runtime.
 */

import type OpenAI from 'openai';

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

export interface OpenAIAgentAdapterOptions {
  name?: string;
  model?: string;
}

export class OpenAIAgentAdapter {
  private client: OpenAI;
  private _name: string;
  private _model: string;

  constructor(client: OpenAI, options: OpenAIAgentAdapterOptions = {}) {
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

  get metadata(): AgentMetadata {
    return {
      description: 'openai adapter',
      capabilities: { streaming: true },
      input: ADAPTER_INPUT,
      output: { type: 'string' },
      adapter: 'openai',
    };
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

export function wrapAgent(
  client: OpenAI,
  options: OpenAIAgentAdapterOptions = {}
): OpenAIAgentAdapter {
  return new OpenAIAgentAdapter(client, options);
}

export interface WrapAndServeOptions extends OpenAIAgentAdapterOptions, ServeOptions {}

export function serveAgent(client: OpenAI, options: WrapAndServeOptions = {}): void {
  const { port, hostname, ...adapterOptions } = options;
  const agent = wrapAgent(client, adapterOptions);
  serve({ agents: [agent], port, hostname });
}
