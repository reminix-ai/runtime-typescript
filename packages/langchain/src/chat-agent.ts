/**
 * LangChain chat agent for Reminix Runtime.
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
  AGENT_TYPES,
  messageContentToText,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
  type Message,
} from '@reminix/runtime';

/**
 * Convert a Reminix message to a LangChain message.
 *
 * Exported for reuse by the langgraph agent.
 */
export function toLangChainMessage(message: Message): BaseMessage {
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

export interface LangChainChatAgentOptions {
  name?: string;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class LangChainChatAgent {
  private agent: Runnable;
  private _name: string;
  private _description: string;
  private _instructions: string | undefined;
  private _tags: string[] | undefined;
  private _extraMetadata: Record<string, unknown> | undefined;

  constructor(agent: Runnable, options: LangChainChatAgentOptions = {}) {
    this.agent = agent;
    this._name = options.name ?? 'langchain-agent';
    this._description = options.description ?? 'langchain chat agent';
    this._instructions = options.instructions;
    this._tags = options.tags;
    this._extraMetadata = options.metadata;
  }

  get name(): string {
    return this._name;
  }

  get metadata(): AgentMetadata {
    const result: AgentMetadata = {
      description: this._description,
      capabilities: { streaming: true },
      input: AGENT_TYPES['chat'].input,
      output: AGENT_TYPES['chat'].output,
      framework: 'langchain',
      type: 'chat',
    };
    if (this._tags) {
      result.tags = this._tags;
    }
    if (this._extraMetadata) {
      Object.assign(result, this._extraMetadata);
    }
    return result;
  }

  private buildLangChainInput(request: AgentRequest): unknown {
    const messages = buildMessagesFromInput(request);

    if ('messages' in request.input) {
      const lcMessages = messages.map((m) => toLangChainMessage(m));
      if (this._instructions) {
        lcMessages.unshift(new SystemMessage({ content: this._instructions }));
      }
      return lcMessages;
    } else if ('prompt' in request.input) {
      return (request.input as Record<string, unknown>).prompt;
    } else {
      return request.input;
    }
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const invokeInput = this.buildLangChainInput(request);
    const response = await this.agent.invoke(invokeInput);

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

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    const streamInput = this.buildLangChainInput(request);

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
