/**
 * LangChain task agent for Reminix Runtime.
 *
 * Accepts a CompiledStateGraph (from createAgent, with tools) or a plain Runnable.
 * Returns structured output from a single-shot task execution.
 */

import { HumanMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';

import { Agent, AGENT_TYPES, type AgentRequest, type AgentResponse } from '@reminix/runtime';

export interface LangChainTaskAgentOptions {
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
    'getGraph' in agent &&
    typeof (agent as unknown as Record<string, unknown>).getGraph === 'function'
  );
}

export class LangChainTaskAgent extends Agent {
  private agent: Runnable;
  private _isGraph: boolean;

  constructor(agent: Runnable, options: LangChainTaskAgentOptions = {}) {
    super(options.name ?? 'langchain-task-agent', {
      description: options.description ?? 'langchain task agent',
      streaming: false,
      inputSchema: AGENT_TYPES['task'].inputSchema,
      outputSchema: AGENT_TYPES['task'].outputSchema,
      type: 'task',
      framework: 'langchain',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.agent = agent;
    this._isGraph = isCompiledStateGraph(agent);
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const task = (request.input as Record<string, unknown>).task;
    const prompt = typeof task === 'string' ? task : JSON.stringify(request.input);

    let output: unknown;

    if (this._isGraph) {
      // CompiledStateGraph: invoke with { messages } containing the task prompt
      const result = await this.agent.invoke({
        messages: [new HumanMessage({ content: prompt })],
      });
      // Extract structured output from the last AI message
      const messages = (result as { messages: Array<{ content: unknown }> }).messages;
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage?.content;
      if (typeof content === 'string') {
        try {
          output = JSON.parse(content);
        } catch {
          output = content;
        }
      } else {
        output = content;
      }
    } else {
      // Plain Runnable: invoke directly with the prompt
      const result = await this.agent.invoke(prompt);
      if (result && typeof result === 'object' && 'content' in result) {
        const content = (result as { content: unknown }).content;
        if (typeof content === 'string') {
          try {
            output = JSON.parse(content);
          } catch {
            output = content;
          }
        } else {
          output = content;
        }
      } else if (result && typeof result === 'object') {
        output = result;
      } else {
        output = String(result);
      }
    }

    return { output };
  }
}
