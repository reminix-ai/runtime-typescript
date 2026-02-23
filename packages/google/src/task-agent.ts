/**
 * Google Gemini task agent for Reminix Runtime.
 */

import { FunctionCallingConfigMode } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';

import { Agent, AGENT_TYPES, type AgentRequest, type AgentResponse } from '@reminix/runtime';

export interface GoogleTaskAgentOptions {
  outputSchema: Record<string, unknown>;
  name?: string;
  model?: string;
  maxTokens?: number;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class GoogleTaskAgent extends Agent {
  private client: GoogleGenAI;
  private _userOutputSchema: Record<string, unknown>;
  private _model: string;
  private _maxTokens: number;

  constructor(client: GoogleGenAI, options: GoogleTaskAgentOptions) {
    super(options.name ?? 'google-task-agent', {
      description: options.description ?? 'google task agent',
      streaming: false,
      inputSchema: AGENT_TYPES['task'].inputSchema,
      outputSchema: AGENT_TYPES['task'].outputSchema,
      type: 'task',
      framework: 'google',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.client = client;
    this._userOutputSchema = options.outputSchema;
    this._model = options.model ?? 'gemini-2.5-flash';
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

    const response = await this.client.models.generateContent({
      model: this._model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        ...(this.instructions && { systemInstruction: this.instructions }),
        maxOutputTokens: this._maxTokens,
        tools: [
          {
            functionDeclarations: [
              {
                name: 'task_result',
                description: 'Return the structured result of the task',
                parameters: this._userOutputSchema,
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['task_result'],
          },
        },
      },
    });

    // Extract structured output from function call
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.functionCall) {
        return { output: part.functionCall.args };
      }
    }

    return { output: {} };
  }
}
