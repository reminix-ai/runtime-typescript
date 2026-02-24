/**
 * Vercel AI SDK task agent for Reminix Runtime.
 *
 * Accepts a ToolLoopAgent (pre-configured with tools) or a plain LanguageModel.
 * Returns structured output from a single-shot task execution.
 */

import type { ToolLoopAgent } from 'ai';
import { generateText, type LanguageModel } from 'ai';

import { Agent, AGENT_TYPES, type AgentRequest, type AgentResponse } from '@reminix/runtime';

export interface VercelAITaskAgentOptions {
  name?: string;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolLoopAgent = ToolLoopAgent<any, any, any>;

function isToolLoopAgent(input: unknown): input is AnyToolLoopAgent {
  return (
    input !== null &&
    typeof input === 'object' &&
    'generate' in input &&
    typeof (input as AnyToolLoopAgent).generate === 'function'
  );
}

export class VercelAITaskAgent extends Agent {
  private modelOrAgent: LanguageModel | AnyToolLoopAgent;
  private isAgent: boolean;

  protected _generateText = generateText;

  constructor(
    modelOrAgent: LanguageModel | AnyToolLoopAgent,
    options: VercelAITaskAgentOptions = {}
  ) {
    super(options.name ?? 'vercel-ai-task-agent', {
      description: options.description ?? 'vercel-ai task agent',
      streaming: false,
      inputSchema: AGENT_TYPES['task'].inputSchema,
      outputSchema: AGENT_TYPES['task'].outputSchema,
      type: 'task',
      framework: 'vercel-ai',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.modelOrAgent = modelOrAgent;
    this.isAgent = isToolLoopAgent(modelOrAgent);
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const task = (request.input as Record<string, unknown>).task;
    const prompt = typeof task === 'string' ? task : JSON.stringify(request.input);

    let output: unknown;

    if (this.isAgent) {
      const agent = this.modelOrAgent as AnyToolLoopAgent;
      const result = await agent.generate({ prompt, options: {} });
      // Prefer structured output if available, fall back to text
      output = result.output ?? result.text;
    } else {
      const model = this.modelOrAgent as LanguageModel;
      const result = await this._generateText({
        model,
        prompt,
        ...(this.instructions && { system: this.instructions }),
      });
      // Try to parse as JSON for structured output
      try {
        output = JSON.parse(result.text);
      } catch {
        output = result.text;
      }
    }

    return { output };
  }
}
