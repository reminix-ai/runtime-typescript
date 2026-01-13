/**
 * Vercel AI SDK adapter for Reminix Runtime.
 */

import { generateText, type CoreMessage, type LanguageModel } from 'ai';

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Options for wrapping a Vercel AI model.
 */
export interface VercelAIAdapterOptions {
  name?: string;
}

/**
 * Adapter for Vercel AI SDK models.
 */
export class VercelAIAdapter extends BaseAdapter {
  private model: LanguageModel;
  private _name: string;

  /**
   * Internal generateText function, can be overridden for testing.
   */
  protected _generateText = generateText;

  /**
   * Initialize the adapter.
   *
   * @param model - A Vercel AI SDK language model.
   * @param options - Adapter options.
   */
  constructor(model: LanguageModel, options: VercelAIAdapterOptions = {}) {
    super();
    this.model = model;
    this._name = options.name ?? 'vercel-ai-agent';
  }

  get name(): string {
    return this._name;
  }

  /**
   * Convert Reminix messages to Vercel AI CoreMessage format.
   */
  private toVercelMessages(messages: Message[]): CoreMessage[] {
    return messages.map((m) => ({
      role: m.role as CoreMessage['role'],
      content: m.content,
    }));
  }

  /**
   * Handle an invoke request.
   *
   * @param request - The invoke request with messages.
   * @returns The invoke response with the model's reply.
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    // Convert messages to Vercel AI format
    const messages = this.toVercelMessages(request.messages);

    // Call generateText
    const result = await this._generateText({
      model: this.model,
      messages,
    });

    // Extract content from response
    const content = result.text;

    // Build response messages (original + assistant response)
    const responseMessages: Message[] = [
      ...request.messages,
      { role: 'assistant', content },
    ];

    return { content, messages: responseMessages };
  }

  /**
   * Handle a chat request.
   *
   * @param request - The chat request with messages.
   * @returns The chat response with the model's reply.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Convert messages to Vercel AI format
    const messages = this.toVercelMessages(request.messages);

    // Call generateText
    const result = await this._generateText({
      model: this.model,
      messages,
    });

    // Extract content from response
    const content = result.text;

    // Build response messages (original + assistant response)
    const responseMessages: Message[] = [
      ...request.messages,
      { role: 'assistant', content },
    ];

    return { content, messages: responseMessages };
  }
}

/**
 * Wrap a Vercel AI SDK model for use with Reminix Runtime.
 *
 * @param model - A Vercel AI SDK language model.
 * @param options - Adapter options.
 * @returns A VercelAIAdapter instance.
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai';
 * import { wrap } from '@reminix/vercel-ai';
 * import { serve } from '@reminix/runtime';
 *
 * const model = openai('gpt-4o');
 * const agent = wrap(model, { name: 'my-agent' });
 * serve([agent], { port: 8080 });
 * ```
 */
export function wrap(
  model: LanguageModel,
  options: VercelAIAdapterOptions = {}
): VercelAIAdapter {
  return new VercelAIAdapter(model, options);
}
