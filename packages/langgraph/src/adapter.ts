/**
 * LangGraph adapter for Reminix Runtime.
 */

import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { CompiledGraph } from '@langchain/langgraph';

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
  type Message,
} from '@reminix/runtime';

/**
 * State type for LangGraph graphs.
 */
interface GraphState {
  messages: BaseMessage[];
  [key: string]: unknown;
}

/**
 * Adapter for LangGraph compiled graphs.
 */
export class LangGraphAdapter extends BaseAdapter {
  private graph: CompiledGraph<GraphState>;
  private _name: string;

  /**
   * Initialize the adapter.
   *
   * @param graph - A LangGraph compiled graph.
   * @param name - Name for the agent.
   */
  constructor(graph: CompiledGraph<GraphState>, name: string = 'langgraph-agent') {
    super();
    this.graph = graph;
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
        return new ToolMessage({ content, tool_call_id: 'unknown' });
      default:
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
   * Extract content from the last AI message.
   */
  private getLastAIContent(messages: BaseMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message instanceof AIMessage) {
        return typeof message.content === 'string'
          ? message.content
          : String(message.content);
      }
    }
    return '';
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

    // Call the graph with state dict format
    const result = await this.graph.invoke({ messages: lcMessages });

    // Extract messages from result
    const resultMessages: BaseMessage[] = result.messages || [];

    // Get content from the last AI message
    const content = this.getLastAIContent(resultMessages);

    // Convert all messages back to Reminix format
    const responseMessages = resultMessages.map((m) => this.toReminixMessage(m));

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

    // Call the graph with state dict format
    const result = await this.graph.invoke({ messages: lcMessages });

    // Extract messages from result
    const resultMessages: BaseMessage[] = result.messages || [];

    // Get content from the last AI message
    const content = this.getLastAIContent(resultMessages);

    // Convert all messages back to Reminix format
    const responseMessages = resultMessages.map((m) => this.toReminixMessage(m));

    return { content, messages: responseMessages };
  }
}

/**
 * Wrap a LangGraph compiled graph for use with Reminix Runtime.
 *
 * @param graph - A LangGraph compiled graph.
 * @param name - Name for the agent.
 * @returns A LangGraphAdapter instance.
 *
 * @example
 * ```typescript
 * import { createReactAgent } from '@langchain/langgraph/prebuilt';
 * import { ChatOpenAI } from '@langchain/openai';
 * import { wrap } from '@reminix/langgraph';
 * import { serve } from '@reminix/runtime';
 *
 * const llm = new ChatOpenAI({ model: 'gpt-4' });
 * const graph = createReactAgent({ llm, tools: [] });
 * const agent = wrap(graph, 'my-agent');
 * serve([agent], { port: 8080 });
 * ```
 */
export function wrap(
  graph: CompiledGraph<GraphState>,
  name: string = 'langgraph-agent'
): LangGraphAdapter {
  return new LangGraphAdapter(graph, name);
}
