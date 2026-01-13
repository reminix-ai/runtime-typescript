/**
 * LangGraph adapter for Reminix Runtime.
 */

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
} from '@reminix/runtime';

export class LangGraphAdapter extends BaseAdapter {
  private agent: unknown;
  private _name: string;

  constructor(agent: unknown, name: string = 'langgraph-agent') {
    super();
    this.agent = agent;
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // TODO: Implement
    throw new Error('Not implemented');
  }
}

/**
 * Wrap a LangGraph agent for use with Reminix Runtime.
 *
 * @param agent - A LangGraph compiled graph.
 * @param name - Name for the agent.
 * @returns A LangGraphAdapter instance.
 */
export function wrap(
  agent: unknown,
  name: string = 'langgraph-agent'
): LangGraphAdapter {
  return new LangGraphAdapter(agent, name);
}
