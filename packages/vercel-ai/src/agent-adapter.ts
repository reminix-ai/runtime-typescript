/**
 * Vercel AI SDK adapter for Reminix Runtime.
 *
 * Supports both ToolLoopAgent (for agents with tools) and LanguageModel (for generateText).
 */

import type { ToolLoopAgent } from 'ai';
import { generateText, streamText, type LanguageModel, type ModelMessage } from 'ai';

import {
  AgentAdapter,
  serve,
  type ServeOptions,
  type ExecuteRequest,
  type ExecuteResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Options for wrapping a Vercel AI model or agent.
 */
export interface VercelAIAgentAdapterOptions {
  name?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolLoopAgent = ToolLoopAgent<any, any, any>;

/**
 * Type guard to check if the input is a ToolLoopAgent.
 */
function isToolLoopAgent(input: unknown): input is AnyToolLoopAgent {
  return (
    input !== null &&
    typeof input === 'object' &&
    'generate' in input &&
    typeof (input as AnyToolLoopAgent).generate === 'function'
  );
}

/**
 * Adapter for Vercel AI SDK models and agents.
 *
 * Supports:
 * - ToolLoopAgent: Full agent with tools and automatic tool loop handling
 * - LanguageModel: Simple model for text generation without tools
 */
export class VercelAIAgentAdapter extends AgentAdapter {
  static adapterName = 'vercel-ai';

  private modelOrAgent: LanguageModel | AnyToolLoopAgent;
  private isAgent: boolean;
  private _name: string;

  /**
   * Internal generateText function, can be overridden for testing.
   */
  protected _generateText = generateText;

  /**
   * Internal streamText function, can be overridden for testing.
   */
  protected _streamText = streamText;

  /**
   * Initialize the adapter.
   *
   * @param modelOrAgent - A Vercel AI SDK ToolLoopAgent or LanguageModel.
   * @param options - Adapter options.
   */
  constructor(
    modelOrAgent: LanguageModel | AnyToolLoopAgent,
    options: VercelAIAgentAdapterOptions = {}
  ) {
    super();
    this.modelOrAgent = modelOrAgent;
    this.isAgent = isToolLoopAgent(modelOrAgent);
    this._name = options.name ?? 'vercel-ai-agent';
  }

  get name(): string {
    return this._name;
  }

  /**
   * Convert Reminix messages to Vercel AI ModelMessage format.
   */
  private toModelMessages(messages: Message[]): ModelMessage[] {
    return messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content || '',
    }));
  }

  /**
   * Build prompt or messages from execute request.
   */
  private buildInputFromRequest(request: ExecuteRequest): {
    prompt?: string;
    messages?: ModelMessage[];
  } {
    const input = request.input as Record<string, unknown>;

    if ('messages' in input) {
      const messages = input.messages as Message[];
      return { messages: this.toModelMessages(messages) };
    } else if ('prompt' in input) {
      return { prompt: String(input.prompt) };
    } else {
      return { prompt: JSON.stringify(input) };
    }
  }

  /**
   * Handle an execute request.
   *
   * For both task-oriented and chat-style operations. Expects input with 'messages' key
   * or a 'prompt' key for simple text generation.
   *
   * @param request - The execute request with input data.
   * @returns The execute response with the output.
   */
  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    const { prompt, messages } = this.buildInputFromRequest(request);

    let output: string;

    if (this.isAgent) {
      // Use ToolLoopAgent.generate()
      const agent = this.modelOrAgent as AnyToolLoopAgent;
      // Agent API expects either prompt or messages, not both
      const agentInput = prompt ? { prompt, options: {} } : { messages: messages!, options: {} };
      const result = await agent.generate(agentInput);
      output = result.text;
    } else {
      // Use generateText with LanguageModel
      const model = this.modelOrAgent as LanguageModel;
      const result = await this._generateText({
        model,
        ...(prompt ? { prompt } : { messages: messages! }),
      });
      output = result.text;
    }

    return { output };
  }

  /**
   * Handle a streaming execute request.
   *
   * @param request - The execute request with input data.
   * @yields JSON-encoded chunks from the stream.
   */
  async *executeStream(request: ExecuteRequest): AsyncGenerator<string, void, unknown> {
    const { prompt, messages } = this.buildInputFromRequest(request);

    if (this.isAgent) {
      // Use ToolLoopAgent.stream()
      const agent = this.modelOrAgent as AnyToolLoopAgent;
      // Agent API expects either prompt or messages, not both
      const agentInput = prompt ? { prompt, options: {} } : { messages: messages!, options: {} };
      const result = await agent.stream(agentInput);
      for await (const chunk of result.textStream) {
        yield JSON.stringify({ chunk });
      }
    } else {
      // Use streamText with LanguageModel
      const model = this.modelOrAgent as LanguageModel;
      const result = this._streamText({
        model,
        ...(prompt ? { prompt } : { messages: messages! }),
      });
      for await (const chunk of result.textStream) {
        yield JSON.stringify({ chunk });
      }
    }
  }
}

/**
 * Wrap a Vercel AI SDK model or agent for use with Reminix Runtime.
 *
 * Supports both ToolLoopAgent (for agents with tools) and LanguageModel (for generateText).
 *
 * @param modelOrAgent - A Vercel AI SDK ToolLoopAgent or LanguageModel.
 * @param options - Adapter options.
 * @returns A VercelAIAgentAdapter instance.
 *
 * @example
 * ```typescript
 * // Option 1: ToolLoopAgent (with tools)
 * import { ToolLoopAgent, tool } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 * import { wrap } from '@reminix/vercel-ai';
 * import { serve } from '@reminix/runtime';
 *
 * const agent = new ToolLoopAgent({
 *   model: openai('gpt-4o'),
 *   tools: {
 *     getWeather: tool({
 *       description: 'Get weather for a city',
 *       inputSchema: z.object({ city: z.string() }),
 *       execute: async ({ city }) => ({ temp: 72, condition: 'sunny' })
 *     })
 *   }
 * });
 *
 * const reminixAgent = wrapAgent(agent, { name: 'weather-agent' });
 * serve({ agents: [reminixAgent], port: 8080 });
 *
 * // Option 2: Model (simple completions with generateText)
 * import { openai } from '@ai-sdk/openai';
 * import { wrap } from '@reminix/vercel-ai';
 *
 * const model = openai('gpt-4o');
 * const reminixAgent = wrapAgent(model, { name: 'chat-agent' });
 * ```
 */
export function wrapAgent(
  modelOrAgent: LanguageModel | AnyToolLoopAgent,
  options: VercelAIAgentAdapterOptions = {}
): VercelAIAgentAdapter {
  return new VercelAIAgentAdapter(modelOrAgent, options);
}

/**
 * Options for wrapping and serving a Vercel AI model or agent.
 */
export interface WrapAndServeOptions extends VercelAIAgentAdapterOptions, ServeOptions {}

/**
 * Wrap a Vercel AI model or agent and serve it immediately.
 *
 * This is a convenience function that combines `wrapAgent` and `serve` for single-agent setups.
 *
 * @param modelOrAgent - A Vercel AI SDK ToolLoopAgent or LanguageModel.
 * @param options - Combined adapter and server options.
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai';
 * import { serveAgent } from '@reminix/vercel-ai';
 *
 * const model = openai('gpt-4o');
 * serveAgent(model, { name: 'my-agent', port: 8080 });
 * ```
 */
export function serveAgent(
  modelOrAgent: LanguageModel | AnyToolLoopAgent,
  options: WrapAndServeOptions = {}
): void {
  const { port, hostname, ...adapterOptions } = options;
  const agent = wrapAgent(modelOrAgent, adapterOptions);
  serve({ agents: [agent], port, hostname });
}
