/**
 * Google Gemini chat agent for Reminix Runtime.
 */

import type { GoogleGenAI } from '@google/genai';

import {
  Agent,
  AGENT_TYPES,
  messageContentToText,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
  type Message,
} from '@reminix/runtime';

export interface GoogleChatAgentOptions {
  name?: string;
  model?: string;
  maxTokens?: number;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export class GoogleChatAgent extends Agent {
  private client: GoogleGenAI;
  private _model: string;
  private _maxTokens: number;

  constructor(client: GoogleGenAI, options: GoogleChatAgentOptions = {}) {
    super(options.name ?? 'google-agent', {
      description: options.description ?? 'google chat agent',
      streaming: true,
      inputSchema: AGENT_TYPES['chat'].inputSchema,
      outputSchema: AGENT_TYPES['chat'].outputSchema,
      type: 'chat',
      framework: 'google',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.client = client;
    this._model = options.model ?? 'gemini-2.5-flash';
    this._maxTokens = options.maxTokens ?? 4096;
  }

  get model(): string {
    return this._model;
  }

  private extractSystemAndContents(messages: Message[]): {
    system: string | undefined;
    contents: GeminiContent[];
  } {
    let system: string | undefined;
    const contents: GeminiContent[] = [];

    for (const message of messages) {
      const text = messageContentToText(message.content);
      if (message.role === 'system' || message.role === 'developer') {
        system = text;
      } else if (message.role === 'user') {
        contents.push({ role: 'user', parts: [{ text }] });
      } else if (message.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text }] });
      }
    }

    return { system, contents };
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const messages = buildMessagesFromInput(request);
    const { system, contents } = this.extractSystemAndContents(messages);
    const effectiveSystem = this.instructions
      ? system
        ? this.instructions + '\n\n' + system
        : this.instructions
      : system;

    const response = await this.client.models.generateContent({
      model: this._model,
      contents,
      config: {
        ...(effectiveSystem && { systemInstruction: effectiveSystem }),
        maxOutputTokens: this._maxTokens,
      },
    });

    return { output: response.text ?? '' };
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    const messages = buildMessagesFromInput(request);
    const { system, contents } = this.extractSystemAndContents(messages);
    const effectiveSystem = this.instructions
      ? system
        ? this.instructions + '\n\n' + system
        : this.instructions
      : system;

    const stream = await this.client.models.generateContentStream({
      model: this._model,
      contents,
      config: {
        ...(effectiveSystem && { systemInstruction: effectiveSystem }),
        maxOutputTokens: this._maxTokens,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }
}
