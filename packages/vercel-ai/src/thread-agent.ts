/**
 * Vercel AI SDK thread agent for Reminix Runtime.
 *
 * Uses generateText() with tools and stopWhen — Vercel AI SDK handles the tool loop natively.
 */

import { generateText, tool as vercelTool, jsonSchema, stepCountIs, type LanguageModel } from 'ai';

import {
  Agent,
  AGENT_TYPES,
  type Tool,
  buildMessagesFromInput,
  messageContentToText,
  type AgentRequest,
  type AgentResponse,
  type Message,
  type ToolRequest,
} from '@reminix/runtime';

export interface VercelAIThreadAgentOptions {
  tools: Tool[];
  name?: string;
  maxTurns?: number;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolSet = Record<string, ReturnType<typeof vercelTool<any, any>>>;

export class VercelAIThreadAgent extends Agent {
  private model: LanguageModel;
  private tools: Tool[];
  private _maxTurns: number;

  protected _generateText = generateText;

  constructor(model: LanguageModel, options: VercelAIThreadAgentOptions) {
    super(options.name ?? 'vercel-ai-thread-agent', {
      description: options.description ?? 'vercel-ai thread agent',
      streaming: false,
      inputSchema: AGENT_TYPES['thread'].input,
      outputSchema: AGENT_TYPES['thread'].output,
      type: 'thread',
      framework: 'vercel-ai',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.model = model;
    this.tools = options.tools;
    this._maxTurns = options.maxTurns ?? 10;
  }

  private buildVercelTools(): AnyToolSet {
    const result: AnyToolSet = {};
    for (const t of this.tools) {
      result[t.name] = vercelTool({
        description: t.metadata.description,
        inputSchema: jsonSchema(t.metadata.inputSchema as Record<string, unknown>),
        execute: async (args: Record<string, unknown>) => {
          const toolRequest: ToolRequest = { arguments: args };
          const response = await t.call(toolRequest);
          return response.output;
        },
      });
    }
    return result;
  }

  private toModelMessages(messages: Message[]): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> {
    return messages.map((m) => {
      const role = m.role === 'developer' ? 'system' : m.role;
      const validRole =
        role === 'user' || role === 'assistant' || role === 'system' ? role : 'user';
      return {
        role: validRole,
        content: messageContentToText(m.content) || '',
      };
    });
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const inputMessages = buildMessagesFromInput(request);
    const modelMessages = this.toModelMessages(inputMessages);
    const vercelTools = this.buildVercelTools();

    const result = await this._generateText({
      model: this.model,
      messages: modelMessages,
      tools: vercelTools,
      stopWhen: stepCountIs(this._maxTurns),
      ...(this.instructions && { system: this.instructions }),
    });

    // Build output messages from the input + response messages
    const outputMessages: Message[] = [...inputMessages];

    // Add response messages from Vercel AI SDK
    for (const msg of result.response.messages) {
      if (msg.role === 'assistant') {
        const textParts: string[] = [];
        const toolCalls: Message['tool_calls'] = [];

        if (typeof msg.content === 'string') {
          textParts.push(msg.content);
        } else {
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

        outputMessages.push({
          role: 'assistant',
          content: textParts.join(' ') || '',
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
        });
      } else if (msg.role === 'tool') {
        for (const part of msg.content) {
          if (part.type === 'tool-result') {
            const outputVal = part.output;
            let content: string;
            if (outputVal && typeof outputVal === 'object' && 'value' in outputVal) {
              content = JSON.stringify((outputVal as { value: unknown }).value);
            } else {
              content = JSON.stringify(outputVal);
            }
            outputMessages.push({
              role: 'tool',
              content,
              tool_call_id: part.toolCallId,
            });
          }
        }
      }
    }

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
