/**
 * Vercel AI SDK adapter for Reminix Runtime.
 */

import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
} from '@reminix/runtime';

export class VercelAIAdapter extends BaseAdapter {
  private agent: unknown;
  private _name: string;

  constructor(agent: unknown, name: string = 'vercel-ai-agent') {
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
 * Wrap a Vercel AI SDK agent for use with Reminix Runtime.
 *
 * @param agent - A Vercel AI SDK agent.
 * @param name - Name for the agent.
 * @returns A VercelAIAdapter instance.
 */
export function wrap(
  agent: unknown,
  name: string = 'vercel-ai-agent'
): VercelAIAdapter {
  return new VercelAIAdapter(agent, name);
}
