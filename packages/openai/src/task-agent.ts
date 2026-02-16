/**
 * OpenAI task agent for Reminix Runtime.
 */

import type OpenAI from 'openai';

import { Agent, AGENT_TYPES, type AgentRequest, type AgentResponse } from '@reminix/runtime';

export interface OpenAITaskAgentOptions {
  name?: string;
  model?: string;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class OpenAITaskAgent extends Agent {
  private client: OpenAI;
  private _responseSchema: Record<string, unknown>;
  private _model: string;

  constructor(
    client: OpenAI,
    outputSchema: Record<string, unknown>,
    options: OpenAITaskAgentOptions = {}
  ) {
    super(options.name ?? 'openai-task-agent', {
      description: options.description ?? 'openai task agent',
      streaming: false,
      inputSchema: AGENT_TYPES['task'].input,
      outputSchema: AGENT_TYPES['task'].output,
      type: 'task',
      framework: 'openai',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.client = client;
    this._responseSchema = outputSchema;
    this._model = options.model ?? 'gpt-4o-mini';
  }

  get model(): string {
    return this._model;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const task = request.input.task as string;

    // Include any additional context from input
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request.input)) {
      if (key !== 'task') extra[key] = value;
    }
    let prompt = task;
    if (Object.keys(extra).length > 0) {
      prompt += `\n\nContext:\n${JSON.stringify(extra, null, 2)}`;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'user' as const, content: prompt },
    ];
    if (this.instructions) {
      messages.unshift({ role: 'system' as const, content: this.instructions });
    }

    const response = await this.client.chat.completions.create({
      model: this._model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_result',
          schema: this._responseSchema,
        },
      } as OpenAI.Chat.ChatCompletionCreateParams['response_format'],
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const output: unknown = JSON.parse(content);
    return { output };
  }
}
