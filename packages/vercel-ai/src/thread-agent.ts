/**
 * Vercel AI SDK thread agent for Reminix Runtime.
 *
 * Uses generateText() with tools and stopWhen — Vercel AI SDK handles the tool loop natively.
 */

import { generateText, tool as vercelTool, jsonSchema, stepCountIs, type LanguageModel } from 'ai';

import {
  AGENT_TYPES,
  buildMessagesFromInput,
  messageContentToText,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
  type Message,
  type ToolLike,
  type ToolRequest,
} from '@reminix/runtime';

export interface VercelAIThreadAgentOptions {
  name?: string;
  maxTurns?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolSet = Record<string, ReturnType<typeof vercelTool<any, any>>>;

export class VercelAIThreadAgent {
  private model: LanguageModel;
  private tools: ToolLike[];
  private _name: string;
  private _maxTurns: number;

  protected _generateText = generateText;

  constructor(model: LanguageModel, tools: ToolLike[], options: VercelAIThreadAgentOptions = {}) {
    this.model = model;
    this.tools = tools;
    this._name = options.name ?? 'vercel-ai-thread-agent';
    this._maxTurns = options.maxTurns ?? 10;
  }

  get name(): string {
    return this._name;
  }

  get metadata(): AgentMetadata {
    return {
      description: 'vercel-ai thread agent',
      capabilities: { streaming: false },
      input: AGENT_TYPES['thread'].input,
      output: AGENT_TYPES['thread'].output,
      framework: 'vercel-ai',
      type: 'thread',
    };
  }

  private buildVercelTools(): AnyToolSet {
    const result: AnyToolSet = {};
    for (const t of this.tools) {
      result[t.name] = vercelTool({
        description: t.metadata.description,
        inputSchema: jsonSchema(t.metadata.input as Record<string, unknown>),
        execute: async (args: Record<string, unknown>) => {
          const toolRequest: ToolRequest = { input: args };
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
