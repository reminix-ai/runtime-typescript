/**
 * LangChain adapter for Reminix Runtime.
 */

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
} from '@reminix/runtime';

export class LangChainAdapter extends BaseAdapter {
  private agent: unknown;
  private _name: string;

  constructor(agent: unknown, name: string = 'langchain-agent') {
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
 * Wrap a LangChain agent for use with Reminix Runtime.
 *
 * @param agent - A LangChain agent or runnable.
 * @param name - Name for the agent.
 * @returns A LangChainAdapter instance.
 */
export function wrap(
  agent: unknown,
  name: string = 'langchain-agent'
): LangChainAdapter {
  return new LangChainAdapter(agent, name);
}
