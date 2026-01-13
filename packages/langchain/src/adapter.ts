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
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
  type Message,
} from '@reminix/runtime';

/**
 * Adapter for LangChain agents and runnables.
 */
export class LangChainAdapter extends BaseAdapter {
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
        return new ToolMessage({ content: contentStr, tool_call_id: message.tool_call_id || 'unknown' });
      default:
        return new HumanMessage({ content: contentStr });
    }
  }

  /**
   * Convert a LangChain message to a Reminix message.
   */
  private toReminixMessage(message: BaseMessage): Message {
    let role: Message['role'];

    if (message instanceof HumanMessage) {
      role = 'user';
    } else if (message instanceof AIMessage) {
      role = 'assistant';
    } else if (message instanceof SystemMessage) {
      role = 'system';
    } else if (message instanceof ToolMessage) {
      role = 'tool';
    } else {
      role = 'assistant';
    }

    const content =
      typeof message.content === 'string'
        ? message.content
        : String(message.content);

    return { role, content };
  }

  /**
   * Handle an invoke request.
   *
   * For task-oriented operations. Passes the input directly to the runnable.
   *
   * @param request - The invoke request with input data.
   * @returns The invoke response with the output.
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    // Pass input directly to the runnable
    const response = await this.agent.invoke(request.input);

    // Extract output from response
    let output: unknown;
    if (response && typeof response === 'object' && 'content' in response) {
      output =
        typeof response.content === 'string'
          ? response.content
          : String(response.content);
    } else if (response && typeof response === 'object') {
      output = response;
    } else {
      output = String(response);
    }

    return { output };
  }

  /**
   * Handle a chat request.
   *
   * For conversational interactions. Converts messages to LangChain format.
   *
   * @param request - The chat request with messages.
   * @returns The chat response with output and messages.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Convert messages to LangChain format
    const lcMessages = request.messages.map((m) => this.toLangChainMessage(m));

    // Call the runnable
    const response = await this.agent.invoke(lcMessages);

    // Extract content from response
    let output: string;
    let responseMessage: Message;
    if (response && typeof response === 'object' && 'content' in response) {
      output =
        typeof response.content === 'string'
          ? response.content
          : String(response.content);
      responseMessage = this.toReminixMessage(response as BaseMessage);
    } else {
      output = String(response);
      responseMessage = { role: 'assistant', content: output };
    }

    // Build response messages (original + assistant response)
    const responseMessages: Message[] = [
      ...request.messages,
      responseMessage,
    ];

    return { output, messages: responseMessages };
  }
}

/**
 * Wrap a LangChain agent for use with Reminix Runtime.
 *
 * @param agent - A LangChain runnable (e.g., ChatModel, chain, agent).
 * @param name - Name for the agent.
 * @returns A LangChainAdapter instance.
 *
 * @example
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 * import { wrap } from '@reminix/langchain';
 * import { serve } from '@reminix/runtime';
 *
 * const llm = new ChatOpenAI({ model: 'gpt-4' });
 * const agent = wrap(llm, 'my-agent');
 * serve([agent], { port: 8080 });
 * ```
 */
export function wrap(
  agent: Runnable,
  name: string = 'langchain-agent'
): LangChainAdapter {
  return new LangChainAdapter(agent, name);
}
