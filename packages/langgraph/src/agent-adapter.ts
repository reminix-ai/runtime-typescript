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

import {
  AgentAdapter,
  serve,
  messageContentToText,
  type ServeOptions,
  type AgentInvokeRequest,
  type AgentInvokeResponse,
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
 * Graph interface that matches LangGraph compiled graphs.
 */
interface LangGraphRunnable {
  invoke(input: unknown): Promise<unknown>;
  stream(input: unknown): AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>;
}

/**
 * Adapter for LangGraph compiled graphs.
 */
export class LangGraphAgentAdapter extends AgentAdapter {
  static adapterName = 'langgraph';

  private graph: LangGraphRunnable;
  private _name: string;

  /**
   * Initialize the adapter.
   *
   * @param graph - A LangGraph compiled graph.
   * @param name - Name for the agent.
   */
  constructor(graph: LangGraphRunnable, name: string = 'langgraph-agent') {
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
    const { role } = message;
    const contentStr = messageContentToText(message.content);

    switch (role) {
      case 'user':
        return new HumanMessage({ content: contentStr });
      case 'assistant':
        return new AIMessage({ content: contentStr });
      case 'system':
      case 'developer':
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
   * Check if a message is an AI message.
   */
  private isAIMessage(message: BaseMessage): boolean {
    // Check instanceof for proper class instances
    if (message instanceof AIMessage) return true;
    // Also check _getType() for deserialized messages
    if (typeof message._getType === 'function' && message._getType() === 'ai') return true;
    // Fallback: check constructor name
    if (message.constructor?.name === 'AIMessage') return true;
    return false;
  }

  /**
   * Extract content from the last AI message.
   */
  private getLastAIContent(messages: BaseMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (this.isAIMessage(message)) {
        const content = message.content;
        if (typeof content === 'string') {
          if (content) return content;
        } else if (Array.isArray(content)) {
          // Handle array of content blocks (text, tool_use, etc.)
          const textParts = content
            .filter(
              (part): part is { type: 'text'; text: string } =>
                typeof part === 'object' &&
                part !== null &&
                part.type === 'text' &&
                typeof part.text === 'string'
            )
            .map((part) => part.text);
          if (textParts.length > 0) return textParts.join('');
        }
      }
    }
    return '';
  }

  /**
   * Build LangGraph input from invoke request.
   */
  private buildGraphInput(request: AgentInvokeRequest): unknown {
    const input = request.input as Record<string, unknown>;

    if ('messages' in input) {
      const messages = input.messages as Message[];
      const lcMessages = messages.map((m) => this.toLangChainMessage(m));
      return { messages: lcMessages };
    } else {
      return input;
    }
  }

  /**
   * Handle an invoke request.
   *
   * For both task-oriented and chat-style operations.
   *
   * @param request - The invoke request with input data.
   * @returns The invoke response with the output.
   */
  async invoke(request: AgentInvokeRequest): Promise<AgentInvokeResponse> {
    const graphInput = this.buildGraphInput(request);

    // Call the graph
    const result = await this.graph.invoke(graphInput);

    // Extract output from result
    let output: unknown;
    if (result && typeof result === 'object' && 'messages' in result) {
      const messages = (result as GraphState).messages || [];
      output = this.getLastAIContent(messages);
    } else if (result && typeof result === 'object') {
      output = result;
    } else {
      output = String(result);
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
    const graphInput = this.buildGraphInput(request);

    // Stream from the graph (await if stream returns a promise)
    const streamResult = this.graph.stream(graphInput);
    const stream = streamResult instanceof Promise ? await streamResult : streamResult;
    for await (const chunk of stream) {
      // LangGraph streams dicts with node outputs
      if (chunk && typeof chunk === 'object') {
        for (const [, nodeOutput] of Object.entries(chunk as Record<string, unknown>)) {
          if (nodeOutput && typeof nodeOutput === 'object' && 'messages' in nodeOutput) {
            const messages = (nodeOutput as { messages: BaseMessage[] }).messages;
            for (const msg of messages) {
              if (msg instanceof AIMessage) {
                const content = typeof msg.content === 'string' ? msg.content : String(msg.content);
                if (content) {
                  yield JSON.stringify({ chunk: content });
                }
              }
            }
          } else {
            yield JSON.stringify({ chunk: JSON.stringify(nodeOutput) });
          }
        }
      } else {
        yield JSON.stringify({ chunk: String(chunk) });
      }
    }
  }
}

/**
 * Wrap a LangGraph compiled graph for use with Reminix Runtime.
 *
 * @param graph - A LangGraph compiled graph.
 * @param name - Name for the agent.
 * @returns A LangGraphAgentAdapter instance.
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
 * const agent = wrapAgent(graph, 'my-agent');
 * serve({ agents: [agent], port: 8080 });
 * ```
 */
export function wrapAgent(
  graph: LangGraphRunnable,
  name: string = 'langgraph-agent'
): LangGraphAgentAdapter {
  return new LangGraphAgentAdapter(graph, name);
}

/**
 * Options for wrapping and serving a LangGraph graph.
 */
export interface WrapAndServeOptions extends ServeOptions {
  name?: string;
}

/**
 * Wrap a LangGraph graph and serve it immediately.
 *
 * This is a convenience function that combines `wrapAgent` and `serve` for single-agent setups.
 *
 * @param graph - A LangGraph compiled graph.
 * @param options - Combined adapter and server options.
 *
 * @example
 * ```typescript
 * import { createReactAgent } from '@langchain/langgraph/prebuilt';
 * import { ChatOpenAI } from '@langchain/openai';
 * import { serveAgent } from '@reminix/langgraph';
 *
 * const llm = new ChatOpenAI({ model: 'gpt-4' });
 * const graph = createReactAgent({ llm, tools: [] });
 * serveAgent(graph, { name: 'my-agent', port: 8080 });
 * ```
 */
export function serveAgent(graph: LangGraphRunnable, options: WrapAndServeOptions = {}): void {
  const { port, hostname, name } = options;
  const agent = wrapAgent(graph, name);
  serve({ agents: [agent], port, hostname });
}
