/**
 * OpenAI task agent for Reminix Runtime.
 */

import type OpenAI from 'openai';

import {
  AGENT_TEMPLATES,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
} from '@reminix/runtime';

export interface OpenAITaskAgentOptions {
  name?: string;
  model?: string;
}

export class OpenAITaskAgent {
  private client: OpenAI;
  private _outputSchema: Record<string, unknown>;
  private _name: string;
  private _model: string;

  constructor(
    client: OpenAI,
    outputSchema: Record<string, unknown>,
    options: OpenAITaskAgentOptions = {}
  ) {
    this.client = client;
    this._outputSchema = outputSchema;
    this._name = options.name ?? 'openai-task-agent';
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
      description: 'openai task agent',
      capabilities: { streaming: false },
      input: AGENT_TEMPLATES['task'].input,
      output: AGENT_TEMPLATES['task'].output,
      adapter: 'openai',
      template: 'task',
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

    const response = await this.client.chat.completions.create({
      model: this._model,
      messages: [{ role: 'user', content: prompt }],
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
