/**
 * Anthropic task agent for Reminix Runtime.
 */

import type Anthropic from '@anthropic-ai/sdk';

import { Agent, AGENT_TYPES, type AgentRequest, type AgentResponse } from '@reminix/runtime';

export interface AnthropicTaskAgentOptions {
  outputSchema: Record<string, unknown>;
  name?: string;
  model?: string;
  maxTokens?: number;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class AnthropicTaskAgent extends Agent {
  private client: Anthropic;
  private _userOutputSchema: Record<string, unknown>;
  private _model: string;
  private _maxTokens: number;

  constructor(client: Anthropic, options: AnthropicTaskAgentOptions) {
    super(options.name ?? 'anthropic-task-agent', {
      description: options.description ?? 'anthropic task agent',
      streaming: false,
      inputSchema: AGENT_TYPES['task'].input,
      outputSchema: AGENT_TYPES['task'].output,
      type: 'task',
      framework: 'anthropic',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.client = client;
    this._userOutputSchema = options.outputSchema;
    this._model = options.model ?? 'claude-sonnet-4-5-20250929';
    this._maxTokens = options.maxTokens ?? 4096;
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

    const response = await this.client.messages.create({
      model: this._model,
      max_tokens: this._maxTokens,
      messages: [{ role: 'user', content: prompt }],
      ...(this.instructions && { system: this.instructions }),
      tools: [
        {
          name: 'task_result',
          description: 'Return the structured result of the task',
          input_schema: this._userOutputSchema as Anthropic.Tool['input_schema'],
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
