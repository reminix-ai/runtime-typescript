/**
 * Vercel AI SDK thread agent for Reminix Runtime.
 *
 * Accepts a ToolLoopAgent (pre-configured with tools) or a plain LanguageModel.
 * The framework handles the tool loop — this adapter just maps messages in/out.
 */

import type { ToolLoopAgent } from 'ai';
import { generateText, type LanguageModel } from 'ai';

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

import { toModelMessages, fromModelMessages } from './message-utils.js';

export interface VercelAIThreadAgentOptions {
  name?: string;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolLoopAgent = ToolLoopAgent<any, any, any>;

function isToolLoopAgent(input: unknown): input is AnyToolLoopAgent {
  return (
    input !== null &&
    typeof input === 'object' &&
    'generate' in input &&
    typeof (input as AnyToolLoopAgent).generate === 'function'
  );
}

export class VercelAIThreadAgent extends Agent {
  private modelOrAgent: LanguageModel | AnyToolLoopAgent;
  private isAgent: boolean;

  protected _generateText = generateText;

  constructor(
    modelOrAgent: LanguageModel | AnyToolLoopAgent,
    options: VercelAIThreadAgentOptions = {}
  ) {
    super(options.name ?? 'vercel-ai-thread-agent', {
      description: options.description ?? 'vercel-ai thread agent',
      streaming: true,
      inputSchema: AGENT_TYPES['thread'].inputSchema,
      outputSchema: AGENT_TYPES['thread'].outputSchema,
      type: 'thread',
      framework: 'vercel-ai',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.modelOrAgent = modelOrAgent;
    this.isAgent = isToolLoopAgent(modelOrAgent);
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const inputMessages = buildMessagesFromInput(request);
    const modelMessages = toModelMessages(inputMessages);

    let responseMessages: Array<{ role: string; content: unknown }>;

    if (this.isAgent) {
      const agent = this.modelOrAgent as AnyToolLoopAgent;
      const result = await agent.generate({ messages: modelMessages, options: {} });
      responseMessages = result.response.messages;
    } else {
      const model = this.modelOrAgent as LanguageModel;
      const result = await this._generateText({
        model,
        messages: modelMessages,
        ...(this.instructions && { system: this.instructions }),
      });
      responseMessages = result.response.messages;
    }

    // Build output: input messages + converted response messages
    const converted = fromModelMessages(responseMessages);
    const outputMessages = [...inputMessages, ...converted];

    // Strip undefined fields from messages
    const output = outputMessages.map((m) => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      return msg;
    });

    return { output };
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string | StreamEvent, void, unknown> {
    const result = await this.invoke(request);
    const messages = result.output as Message[];
    for (const message of messages) {
      const event: MessageEvent = { type: 'message', message };
      yield event;
    }
  }
}
