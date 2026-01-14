/**
 * Vercel AI SDK adapter for Reminix Runtime.
 *
 * Supports both ToolLoopAgent (for agents with tools) and LanguageModel (for generateText).
 */

import {
  generateText,
  streamText,
  ToolLoopAgent,
  type LanguageModel,
  type ModelMessage,
} from 'ai';

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Options for wrapping a Vercel AI model or agent.
 */
export interface VercelAIAdapterOptions {
  name?: string;
}

/**
 * Type guard to check if the input is a ToolLoopAgent.
 */
function isToolLoopAgent(input: unknown): input is ToolLoopAgent {
  return (
    input !== null &&
    typeof input === 'object' &&
    'generate' in input &&
    typeof (input as ToolLoopAgent).generate === 'function'
  );
}

/**
 * Adapter for Vercel AI SDK models and agents.
 *
 * Supports:
 * - ToolLoopAgent: Full agent with tools and automatic tool loop handling
 * - LanguageModel: Simple model for text generation without tools
 */
export class VercelAIAdapter extends BaseAdapter {
  static adapterName = 'vercel-ai';

  private modelOrAgent: LanguageModel | ToolLoopAgent;
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
  constructor(modelOrAgent: LanguageModel | ToolLoopAgent, options: VercelAIAdapterOptions = {}) {
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
   * Handle an invoke request.
   *
   * For task-oriented operations. Expects input with 'messages' key
   * or a 'prompt' key for simple text generation.
   *
   * @param request - The invoke request with input data.
   * @returns The invoke response with the output.
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    const input = request.input as Record<string, unknown>;

    // Build prompt from input
    let prompt: string;
    if ('prompt' in input) {
      prompt = String(input.prompt);
    } else if ('messages' in input) {
      const messages = input.messages as Array<{ role: string; content: string }>;
      prompt = messages.map(m => m.content).join('\n');
    } else {
      prompt = JSON.stringify(input);
    }

    let output: string;

    if (this.isAgent) {
      // Use ToolLoopAgent.generate()
      const agent = this.modelOrAgent as ToolLoopAgent;
      const result = await agent.generate({ prompt });
      output = result.text;
    } else {
      // Use generateText with LanguageModel
      const model = this.modelOrAgent as LanguageModel;
      const result = await this._generateText({
        model,
        prompt,
      });
      output = result.text;
    }

    return { output };
  }

  /**
   * Handle a chat request.
   *
   * For conversational interactions.
   *
   * @param request - The chat request with messages.
   * @returns The chat response with output and messages.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = this.toModelMessages(request.messages);

    let output: string;

    if (this.isAgent) {
      // Use ToolLoopAgent.generate()
      const agent = this.modelOrAgent as ToolLoopAgent;
      const result = await agent.generate({ messages });
      output = result.text;
    } else {
      // Use generateText with LanguageModel
      const model = this.modelOrAgent as LanguageModel;
      const result = await this._generateText({
        model,
        messages,
      });
      output = result.text;
    }

    // Build response messages (original + assistant response)
    const responseMessages: Message[] = [
      ...request.messages,
      { role: 'assistant', content: output },
    ];

    return { output, messages: responseMessages };
  }

  /**
   * Handle a streaming invoke request.
   *
   * @param request - The invoke request with input data.
   * @yields JSON-encoded chunks from the stream.
   */
  async *invokeStream(
    request: InvokeRequest
  ): AsyncGenerator<string, void, unknown> {
    const input = request.input as Record<string, unknown>;

    // Build prompt from input
    let prompt: string;
    if ('prompt' in input) {
      prompt = String(input.prompt);
    } else if ('messages' in input) {
      const messages = input.messages as Array<{ role: string; content: string }>;
      prompt = messages.map(m => m.content).join('\n');
    } else {
      prompt = JSON.stringify(input);
    }

    if (this.isAgent) {
      // Use ToolLoopAgent.stream()
      const agent = this.modelOrAgent as ToolLoopAgent;
      const result = await agent.stream({ prompt });
      for await (const chunk of result.textStream) {
        yield JSON.stringify({ chunk });
      }
    } else {
      // Use streamText with LanguageModel
      const model = this.modelOrAgent as LanguageModel;
      const result = this._streamText({
        model,
        prompt,
      });
      for await (const chunk of result.textStream) {
        yield JSON.stringify({ chunk });
      }
    }
  }

  /**
   * Handle a streaming chat request.
   *
   * @param request - The chat request with messages.
   * @yields JSON-encoded chunks from the stream.
   */
  async *chatStream(
    request: ChatRequest
  ): AsyncGenerator<string, void, unknown> {
    const messages = this.toModelMessages(request.messages);

    if (this.isAgent) {
      // Use ToolLoopAgent.stream()
      const agent = this.modelOrAgent as ToolLoopAgent;
      const result = await agent.stream({ messages });
      for await (const chunk of result.textStream) {
        yield JSON.stringify({ chunk });
      }
    } else {
      // Use streamText with LanguageModel
      const model = this.modelOrAgent as LanguageModel;
      const result = this._streamText({
        model,
        messages,
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
 * @returns A VercelAIAdapter instance.
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
 * const reminixAgent = wrap(agent, { name: 'weather-agent' });
 * serve([reminixAgent], { port: 8080 });
 *
 * // Option 2: Model (simple completions with generateText)
 * import { openai } from '@ai-sdk/openai';
 * import { wrap } from '@reminix/vercel-ai';
 *
 * const model = openai('gpt-4o');
 * const reminixAgent = wrap(model, { name: 'chat-agent' });
 * ```
 */
export function wrap(
  modelOrAgent: LanguageModel | ToolLoopAgent,
  options: VercelAIAdapterOptions = {}
): VercelAIAdapter {
  return new VercelAIAdapter(modelOrAgent, options);
}
