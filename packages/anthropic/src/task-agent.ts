/**
 * Anthropic task agent for Reminix Runtime.
 */

import type Anthropic from '@anthropic-ai/sdk';

import {
  AGENT_TYPES,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
} from '@reminix/runtime';

export interface AnthropicTaskAgentOptions {
  name?: string;
  model?: string;
  maxTokens?: number;
}

export class AnthropicTaskAgent {
  private client: Anthropic;
  private _outputSchema: Record<string, unknown>;
  private _name: string;
  private _model: string;
  private _maxTokens: number;

  constructor(
    client: Anthropic,
    outputSchema: Record<string, unknown>,
    options: AnthropicTaskAgentOptions = {}
  ) {
    this.client = client;
    this._outputSchema = outputSchema;
    this._name = options.name ?? 'anthropic-task-agent';
    this._model = options.model ?? 'claude-sonnet-4-20250514';
    this._maxTokens = options.maxTokens ?? 4096;
  }

  get name(): string {
    return this._name;
  }

  get model(): string {
    return this._model;
  }

  get metadata(): AgentMetadata {
    return {
      description: 'anthropic task agent',
      capabilities: { streaming: false },
      input: AGENT_TYPES['task'].input,
      output: AGENT_TYPES['task'].output,
      framework: 'anthropic',
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

    const response = await this.client.messages.create({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          name: 'task_result',
          description: 'Return the structured result of the task',
          input_schema: this._outputSchema as Anthropic.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'tool', name: 'task_result' },
    });

    // Extract structured output from tool_use block
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        return { output: block.input };
      }
    }

    return { output: {} };
  }
}
