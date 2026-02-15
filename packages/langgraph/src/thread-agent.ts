/**
 * LangGraph thread agent for Reminix Runtime.
 */

import { AIMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';

import { toLangChainMessage } from '@reminix/langchain';
import {
  AGENT_TYPES,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
} from '@reminix/runtime';

interface GraphState {
  messages: BaseMessage[];
  [key: string]: unknown;
}

interface LangGraphRunnable {
  invoke(input: unknown): Promise<unknown>;
  stream(input: unknown): AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>;
}

export interface LangGraphThreadAgentOptions {
  name?: string;
  description?: string;
  instructions?: string;
}

export class LangGraphThreadAgent {
  private graph: LangGraphRunnable;
  private _name: string;
  private _description: string;
  private _instructions: string | undefined;

  constructor(graph: LangGraphRunnable, options: LangGraphThreadAgentOptions = {}) {
    this.graph = graph;
    this._name = options.name ?? 'langgraph-agent';
    this._description = options.description ?? 'langgraph thread agent';
    this._instructions = options.instructions;
  }

  get name(): string {
    return this._name;
  }

  get metadata(): AgentMetadata {
    return {
      description: this._description,
      capabilities: { streaming: true },
      input: AGENT_TYPES['thread'].input,
      output: { type: 'string' },
      framework: 'langgraph',
      type: 'thread',
    };
  }

  private isAIMessage(message: BaseMessage): boolean {
    if (message instanceof AIMessage) return true;
    if (typeof message._getType === 'function' && message._getType() === 'ai') return true;
    if (message.constructor?.name === 'AIMessage') return true;
    return false;
  }

  private getLastAIContent(messages: BaseMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (this.isAIMessage(message)) {
        const content = message.content;
        if (typeof content === 'string') {
          if (content) return content;
        } else if (Array.isArray(content)) {
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

  private buildGraphInput(request: AgentRequest): unknown {
    if ('messages' in request.input) {
      const messages = buildMessagesFromInput(request);
      const lcMessages = messages.map((m) => toLangChainMessage(m));
      if (this._instructions) {
        lcMessages.unshift(new SystemMessage({ content: this._instructions }));
      }
      return { messages: lcMessages };
    } else {
      return request.input;
    }
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const graphInput = this.buildGraphInput(request);
    const result = await this.graph.invoke(graphInput);

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

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    const graphInput = this.buildGraphInput(request);

    const streamResult = this.graph.stream(graphInput);
    const stream = streamResult instanceof Promise ? await streamResult : streamResult;
    for await (const chunk of stream) {
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
