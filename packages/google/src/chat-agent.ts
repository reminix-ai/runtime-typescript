/**
 * Google Gemini chat agent for Reminix Runtime.
 */

import type { GoogleGenAI } from '@google/genai';

import {
  Agent,
  AGENT_TYPES,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
} from '@reminix/runtime';

import { toGeminiContents } from './message-utils.js';

export interface GoogleChatAgentOptions {
  name?: string;
  model?: string;
  maxTokens?: number;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
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

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const messages = buildMessagesFromInput(request);
    const { system, contents } = toGeminiContents(messages);
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
    const { system, contents } = toGeminiContents(messages);
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
