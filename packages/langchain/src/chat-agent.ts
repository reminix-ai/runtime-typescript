/**
 * LangChain chat adapter for Reminix Runtime.
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
  AGENT_TEMPLATES,
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
 * Exported for reuse by the langgraph adapter.
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

export class LangChainChatAgent {
  private agent: Runnable;
  private _name: string;

  constructor(agent: Runnable, name: string = 'langchain-agent') {
    this.agent = agent;
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get metadata(): AgentMetadata {
    return {
      description: 'langchain adapter',
      capabilities: { streaming: true },
      input: AGENT_TEMPLATES['chat'].input,
      output: AGENT_TEMPLATES['chat'].output,
      adapter: 'langchain',
      template: 'chat',
    };
  }

  private buildLangChainInput(request: AgentRequest): unknown {
    const messages = buildMessagesFromInput(request);

    if ('messages' in request.input) {
      return messages.map((m) => toLangChainMessage(m));
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
