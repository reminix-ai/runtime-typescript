/**
 * OpenAI task agent for Reminix Runtime.
 */

import type OpenAI from 'openai';

import {
  AGENT_TYPES,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
} from '@reminix/runtime';

export interface OpenAITaskAgentOptions {
  name?: string;
  model?: string;
  description?: string;
  instructions?: string;
}

export class OpenAITaskAgent {
  private client: OpenAI;
  private _outputSchema: Record<string, unknown>;
  private _name: string;
  private _model: string;
  private _description: string;
  private _instructions: string | undefined;

  constructor(
    client: OpenAI,
    outputSchema: Record<string, unknown>,
    options: OpenAITaskAgentOptions = {}
  ) {
    this.client = client;
    this._outputSchema = outputSchema;
    this._name = options.name ?? 'openai-task-agent';
    this._model = options.model ?? 'gpt-4o-mini';
    this._description = options.description ?? 'openai task agent';
    this._instructions = options.instructions;
  }

  get name(): string {
    return this._name;
  }

  get model(): string {
    return this._model;
  }

  get metadata(): AgentMetadata {
    return {
      description: this._description,
      capabilities: { streaming: false },
      input: AGENT_TYPES['task'].input,
      output: AGENT_TYPES['task'].output,
      framework: 'openai',
      type: 'task',
    };
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
    if (this._instructions) {
      messages.unshift({ role: 'system' as const, content: this._instructions });
    }

    const response = await this.client.chat.completions.create({
      model: this._model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_result',
          schema: this._outputSchema,
        },
      } as OpenAI.Chat.ChatCompletionCreateParams['response_format'],
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const output: unknown = JSON.parse(content);
    return { output };
  }
}
