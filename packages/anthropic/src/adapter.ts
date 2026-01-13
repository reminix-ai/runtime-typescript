/**
 * Anthropic adapter for Reminix Runtime.
 */

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
} from '@reminix/runtime';

export class AnthropicAdapter extends BaseAdapter {
  private agent: unknown;
  private _name: string;

  constructor(agent: unknown, name: string = 'anthropic-agent') {
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
 * Wrap an Anthropic agent for use with Reminix Runtime.
 *
 * @param agent - An Anthropic agent.
 * @param name - Name for the agent.
 * @returns An AnthropicAdapter instance.
 */
export function wrap(
  agent: unknown,
  name: string = 'anthropic-agent'
): AnthropicAdapter {
  return new AnthropicAdapter(agent, name);
}
