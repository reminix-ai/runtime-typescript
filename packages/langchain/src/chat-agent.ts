/**
 * LangChain chat agent for Reminix Runtime.
 *
 * Accepts a CompiledStateGraph (from createAgent, with tools) or a plain Runnable.
 */

import { SystemMessage, type BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';

import {
  Agent,
  AGENT_TYPES,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
} from '@reminix/runtime';

import { toLangChainMessage } from './message-utils.js';

export interface LangChainChatAgentOptions {
  name?: string;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Detect if a runnable is a CompiledStateGraph (from langgraph createAgent).
 */
function isCompiledStateGraph(agent: Runnable): agent is Runnable & { getGraph: () => unknown } {
  return (
    'getState' in agent &&
    typeof (agent as unknown as Record<string, unknown>).getState === 'function'
  );
}

export class LangChainChatAgent extends Agent {
  private agent: Runnable;
  private _isGraph: boolean;

  constructor(agent: Runnable, options: LangChainChatAgentOptions = {}) {
    super(options.name ?? 'langchain-agent', {
      description: options.description ?? 'langchain chat agent',
      streaming: true,
      inputSchema: AGENT_TYPES['chat'].inputSchema,
      outputSchema: AGENT_TYPES['chat'].outputSchema,
      type: 'chat',
      framework: 'langchain',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.agent = agent;
    this._isGraph = isCompiledStateGraph(agent);
  }

  private buildLangChainInput(request: AgentRequest): unknown {
    const messages = buildMessagesFromInput(request);

    if ('messages' in request.input) {
      const lcMessages = messages.map((m) => toLangChainMessage(m));
      if (this.instructions) {
        lcMessages.unshift(new SystemMessage({ content: this.instructions }));
      }
      if (this._isGraph) {
        return { messages: lcMessages };
      }
      return lcMessages;
    } else if ('prompt' in request.input) {
      const prompt = (request.input as Record<string, unknown>).prompt;
      if (this._isGraph) {
        return { messages: [new SystemMessage({ content: String(prompt) })] };
      }
      return prompt;
    } else {
      if (this._isGraph) {
        return { messages: [new SystemMessage({ content: JSON.stringify(request.input) })] };
      }
      return request.input;
    }
  }

  private extractOutput(response: unknown): unknown {
    if (this._isGraph) {
      // CompiledStateGraph returns { messages: BaseMessage[] }
      const messages = (response as { messages: BaseMessage[] }).messages;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        const content = lastMsg.content;
        return typeof content === 'string' ? content : String(content);
      }
      return '';
    }

    if (response && typeof response === 'object' && 'content' in response) {
      const content = (response as { content: unknown }).content;
      return typeof content === 'string' ? content : String(content);
    } else if (response && typeof response === 'object') {
      return response;
    }
    return String(response);
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const invokeInput = this.buildLangChainInput(request);
    const response = await this.agent.invoke(invokeInput);
    return { output: this.extractOutput(response) };
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    const streamInput = this.buildLangChainInput(request);

    for await (const chunk of await this.agent.stream(streamInput)) {
      let content: string;
      if (this._isGraph) {
        // Graph streams events — extract text content from message chunks
        if (chunk && typeof chunk === 'object' && 'messages' in chunk) {
          const messages = (chunk as { messages: BaseMessage[] }).messages;
          const lastMsg = messages[messages.length - 1];
          if (lastMsg) {
            content =
              typeof lastMsg.content === 'string' ? lastMsg.content : String(lastMsg.content);
          } else {
            continue;
          }
        } else {
          continue;
        }
      } else if (chunk && typeof chunk === 'object' && 'content' in chunk) {
        content =
          typeof (chunk as { content: unknown }).content === 'string'
            ? ((chunk as { content: string }).content as string)
            : String((chunk as { content: unknown }).content);
      } else if (typeof chunk === 'object') {
        content = JSON.stringify(chunk);
      } else {
        content = String(chunk);
      }
      yield content;
    }
  }
}
