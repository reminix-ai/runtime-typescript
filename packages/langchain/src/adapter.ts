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

    switch (role) {
      case 'user':
        return new HumanMessage({ content });
      case 'assistant':
        return new AIMessage({ content });
      case 'system':
        return new SystemMessage({ content });
      case 'tool':
        // Tool messages require a tool_call_id, use a placeholder if not provided
        return new ToolMessage({ content, tool_call_id: 'unknown' });
      default:
        // Fallback to HumanMessage for unknown roles
        return new HumanMessage({ content });
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
   * @param request - The invoke request with messages.
   * @returns The invoke response with the agent's reply.
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    // Convert messages to LangChain format
    const lcMessages = request.messages.map((m) => this.toLangChainMessage(m));

    // Call the runnable
    const response = await this.agent.invoke(lcMessages);

    // Extract content from response
    let content: string;
    if (response && typeof response === 'object' && 'content' in response) {
      content =
        typeof response.content === 'string'
          ? response.content
          : String(response.content);
    } else {
      content = String(response);
    }

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
   * @returns The chat response with the agent's reply.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Convert messages to LangChain format
    const lcMessages = request.messages.map((m) => this.toLangChainMessage(m));

    // Call the runnable
    const response = await this.agent.invoke(lcMessages);

    // Extract content from response
    let content: string;
    if (response && typeof response === 'object' && 'content' in response) {
      content =
        typeof response.content === 'string'
          ? response.content
          : String(response.content);
    } else {
      content = String(response);
    }

    // Build response messages (original + assistant response)
    const responseMessages: Message[] = [
      ...request.messages,
      { role: 'assistant', content },
    ];

    return { content, messages: responseMessages };
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
