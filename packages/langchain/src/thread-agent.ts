/**
 * LangChain thread agent for Reminix Runtime.
 *
 * Accepts a CompiledStateGraph (from createAgent, with tools) or a plain Runnable.
 * Returns the full message thread including tool calls and results.
 */

import { SystemMessage, type BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';

import {
  Agent,
  AGENT_TYPES,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
  type StreamEvent,
  type MessageEvent,
  type Message,
} from '@reminix/runtime';

import { toLangChainMessage, fromLangChainMessage } from './message-utils.js';

export interface LangChainThreadAgentOptions {
  name?: string;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Detect if a runnable is a CompiledStateGraph (from langgraph createAgent).
 * CompiledStateGraphs accept { messages: BaseMessage[] } and return { messages: BaseMessage[] }.
 */
function isCompiledStateGraph(agent: Runnable): agent is Runnable & { getGraph: () => unknown } {
  return (
    'getGraph' in agent &&
    typeof (agent as unknown as Record<string, unknown>).getGraph === 'function'
  );
}

export class LangChainThreadAgent extends Agent {
  private agent: Runnable;
  private _isGraph: boolean;

  constructor(agent: Runnable, options: LangChainThreadAgentOptions = {}) {
    super(options.name ?? 'langchain-thread-agent', {
      description: options.description ?? 'langchain thread agent',
      streaming: true,
      inputSchema: AGENT_TYPES['thread'].inputSchema,
      outputSchema: AGENT_TYPES['thread'].outputSchema,
      type: 'thread',
      framework: 'langchain',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.agent = agent;
    this._isGraph = isCompiledStateGraph(agent);
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const inputMessages = buildMessagesFromInput(request);
    const lcMessages = inputMessages.map((m) => toLangChainMessage(m));

    if (this.instructions) {
      lcMessages.unshift(new SystemMessage({ content: this.instructions }));
    }

    let resultMessages: BaseMessage[];

    if (this._isGraph) {
      // CompiledStateGraph: invoke with { messages } dict, result is { messages }
      const result = await this.agent.invoke({ messages: lcMessages });
      resultMessages = (result as { messages: BaseMessage[] }).messages;
    } else {
      // Plain Runnable: invoke with messages array, result is a single message
      const result = await this.agent.invoke(lcMessages);
      if (Array.isArray(result)) {
        resultMessages = result;
      } else {
        resultMessages = [...lcMessages, result as BaseMessage];
      }
    }

    // Convert all result messages to Reminix format
    const output = resultMessages.map((m) => {
      const msg = fromLangChainMessage(m);
      // Strip undefined fields
      const clean: Record<string, unknown> = { role: msg.role, content: msg.content };
      if (msg.tool_calls) clean.tool_calls = msg.tool_calls;
      if (msg.tool_call_id) clean.tool_call_id = msg.tool_call_id;
      if (msg.name) clean.name = msg.name;
      return clean;
    });

    return { output };
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string | StreamEvent, void, unknown> {
    // Reuse invoke logic to get full message thread, then yield each message as an event
    const result = await this.invoke(request);
    const messages = result.output as Message[];
    for (const message of messages) {
      const event: MessageEvent = { type: 'message', message };
      yield event;
    }
  }
}
