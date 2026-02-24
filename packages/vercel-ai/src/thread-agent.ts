/**
 * Vercel AI SDK thread agent for Reminix Runtime.
 *
 * Accepts a ToolLoopAgent (pre-configured with tools) or a plain LanguageModel.
 * The framework handles the tool loop — this adapter just maps messages in/out.
 */

import type { ToolLoopAgent } from 'ai';
import { generateText, type LanguageModel, type ModelMessage } from 'ai';

import {
  Agent,
  AGENT_TYPES,
  buildMessagesFromInput,
  messageContentToText,
  type AgentRequest,
  type AgentResponse,
  type Message,
} from '@reminix/runtime';

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
      streaming: false,
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

  private toModelMessages(messages: Message[]): ModelMessage[] {
    return messages.map((m) => {
      if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') {
        return { role: 'user' as const, content: messageContentToText(m.content) };
      }
      return {
        role: m.role,
        content: messageContentToText(m.content) || '',
      };
    });
  }

  /**
   * Convert Vercel AI SDK response messages to Reminix Message format.
   */
  private convertResponseMessages(
    responseMessages: Array<{ role: string; content: unknown }>
  ): Message[] {
    const result: Message[] = [];

    for (const msg of responseMessages) {
      if (msg.role === 'assistant') {
        const textParts: string[] = [];
        const toolCalls: Message['tool_calls'] = [];

        if (typeof msg.content === 'string') {
          textParts.push(msg.content);
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'text') {
              textParts.push(part.text);
            } else if (part.type === 'tool-call') {
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.input),
                },
              });
            }
          }
        }

        result.push({
          role: 'assistant',
          content: textParts.join(' ') || '',
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
        });
      } else if (msg.role === 'tool' && Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'tool-result') {
            const outputVal = part.output;
            let content: string;
            if (outputVal && typeof outputVal === 'object' && 'value' in outputVal) {
              content = JSON.stringify((outputVal as { value: unknown }).value);
            } else {
              content = JSON.stringify(outputVal);
            }
            result.push({
              role: 'tool',
              content,
              tool_call_id: part.toolCallId,
            });
          }
        }
      }
    }

    return result;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const inputMessages = buildMessagesFromInput(request);
    const modelMessages = this.toModelMessages(inputMessages);

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
    const converted = this.convertResponseMessages(responseMessages);
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
}
