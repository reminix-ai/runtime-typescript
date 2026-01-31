/**
 * LangChain adapter for Reminix Runtime.
 */

import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';

import {
  AgentAdapter,
  serve,
  type ServeOptions,
  type AgentInvokeRequest,
  type AgentInvokeResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Adapter for LangChain agents and runnables.
 */
export class LangChainAgentAdapter extends AgentAdapter {
  static adapterName = 'langchain';

  private agent: Runnable;
  private _name: string;

  /**
   * Initialize the adapter.
   *
   * @param agent - A LangChain runnable (e.g., ChatModel, chain, agent).
   * @param name - Name for the agent.
   */
  constructor(agent: Runnable, name: string = 'langchain-agent') {
    super();
    this.agent = agent;
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  /**
   * Convert a Reminix message to a LangChain message.
   */
  private toLangChainMessage(message: Message): BaseMessage {
    const { role, content } = message;
    const contentStr = content || '';

    switch (role) {
      case 'user':
        return new HumanMessage({ content: contentStr });
      case 'assistant':
        return new AIMessage({ content: contentStr });
      case 'system':
        return new SystemMessage({ content: contentStr });
      case 'tool':
        return new ToolMessage({
          content: contentStr,
          tool_call_id: message.tool_call_id || 'unknown',
        });
      default:
        return new HumanMessage({ content: contentStr });
    }
  }

  /**
   * Build LangChain input from invoke request.
   */
  private buildLangChainInput(request: AgentInvokeRequest): unknown {
    const input = request.input as Record<string, unknown>;

    if ('messages' in input) {
      const messages = input.messages as Message[];
      return messages.map((m) => this.toLangChainMessage(m));
    } else if ('prompt' in input) {
      return input.prompt;
    } else {
      return input;
    }
  }

  /**
   * Handle an invoke request.
   *
   * For both task-oriented and chat-style operations. Expects input with 'messages' key
   * or a 'prompt' key for simple text generation.
   *
   * @param request - The invoke request with input data.
   * @returns The invoke response with the output.
   */
  async invoke(request: AgentInvokeRequest): Promise<AgentInvokeResponse> {
    const invokeInput = this.buildLangChainInput(request);

    const response = await this.agent.invoke(invokeInput);

    // Extract output from response
    let output: unknown;
    if (response && typeof response === 'object' && 'content' in response) {
      output = typeof response.content === 'string' ? response.content : String(response.content);
    } else if (response && typeof response === 'object') {
      output = response;
    } else {
      output = String(response);
    }

    return { output };
  }

  /**
   * Handle a streaming invoke request.
   *
   * @param request - The invoke request with input data.
   * @yields JSON-encoded chunks from the stream.
   */
  async *invokeStream(request: AgentInvokeRequest): AsyncGenerator<string, void, unknown> {
    const streamInput = this.buildLangChainInput(request);

    // Stream from the runnable
    for await (const chunk of await this.agent.stream(streamInput)) {
      let content: string;
      if (chunk && typeof chunk === 'object' && 'content' in chunk) {
        content = typeof chunk.content === 'string' ? chunk.content : String(chunk.content);
      } else if (typeof chunk === 'object') {
        content = JSON.stringify(chunk);
      } else {
        content = String(chunk);
      }
      yield JSON.stringify({ chunk: content });
    }
  }
}

/**
 * Wrap a LangChain agent for use with Reminix Runtime.
 *
 * @param agent - A LangChain runnable (e.g., ChatModel, chain, agent).
 * @param name - Name for the agent.
 * @returns A LangChainAgentAdapter instance.
 *
 * @example
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 * import { wrap } from '@reminix/langchain';
 * import { serve } from '@reminix/runtime';
 *
 * const llm = new ChatOpenAI({ model: 'gpt-4' });
 * const agent = wrapAgent(llm, 'my-agent');
 * serve({ agents: [agent], port: 8080 });
 * ```
 */
export function wrapAgent(
  agent: Runnable,
  name: string = 'langchain-agent'
): LangChainAgentAdapter {
  return new LangChainAgentAdapter(agent, name);
}

/**
 * Options for wrapping and serving a LangChain runnable.
 */
export interface WrapAndServeOptions extends ServeOptions {
  name?: string;
}

/**
 * Wrap a LangChain runnable and serve it immediately.
 *
 * This is a convenience function that combines `wrapAgent` and `serve` for single-agent setups.
 *
 * @param agent - A LangChain runnable (e.g., ChatModel, chain, agent).
 * @param options - Combined adapter and server options.
 *
 * @example
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 * import { serveAgent } from '@reminix/langchain';
 *
 * const llm = new ChatOpenAI({ model: 'gpt-4' });
 * serveAgent(llm, { name: 'my-agent', port: 8080 });
 * ```
 */
export function serveAgent(agent: Runnable, options: WrapAndServeOptions = {}): void {
  const { port, hostname, name } = options;
  const wrappedAgent = wrapAgent(agent, name);
  serve({ agents: [wrappedAgent], port, hostname });
}
