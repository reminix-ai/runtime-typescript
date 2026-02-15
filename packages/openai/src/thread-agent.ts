/**
 * OpenAI thread agent for Reminix Runtime.
 */

import type OpenAI from 'openai';

import {
  AGENT_TEMPLATES,
  buildMessagesFromInput,
  messageContentToText,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
  type Message,
  type ToolCall,
  type ToolLike,
  type ToolRequest,
} from '@reminix/runtime';

export interface OpenAIThreadAgentOptions {
  name?: string;
  model?: string;
  maxTurns?: number;
}

export class OpenAIThreadAgent {
  private client: OpenAI;
  private toolMap: Map<string, ToolLike>;
  private toolDefinitions: OpenAI.Chat.ChatCompletionTool[];
  private _name: string;
  private _model: string;
  private _maxTurns: number;

  constructor(client: OpenAI, tools: ToolLike[], options: OpenAIThreadAgentOptions = {}) {
    this.client = client;
    this.toolMap = new Map(tools.map((t) => [t.name, t]));
    this.toolDefinitions = tools.map((t) => this.toOpenAITool(t));
    this._name = options.name ?? 'openai-thread-agent';
    this._model = options.model ?? 'gpt-4o-mini';
    this._maxTurns = options.maxTurns ?? 10;
  }

  get name(): string {
    return this._name;
  }

  get model(): string {
    return this._model;
  }

  get metadata(): AgentMetadata {
    return {
      description: 'openai thread agent',
      capabilities: { streaming: false },
      input: AGENT_TEMPLATES['thread'].input,
      output: AGENT_TEMPLATES['thread'].output,
      framework: 'openai',
      template: 'thread',
    };
  }

  private toOpenAITool(tool: ToolLike): OpenAI.Chat.ChatCompletionTool {
    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.metadata.description,
        parameters: tool.metadata.input as OpenAI.FunctionParameters,
      },
    };
  }

  private toOpenAIMessage(message: Message): OpenAI.Chat.ChatCompletionMessageParam {
    const role = message.role === 'developer' ? 'system' : message.role;
    const content = messageContentToText(message.content) || '';

    if (role === 'tool') {
      return {
        role: 'tool',
        content,
        tool_call_id: message.tool_call_id || '',
      };
    }

    if (role === 'assistant') {
      const result: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content,
      };
      if (message.tool_calls) {
        result.tool_calls = message.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }
      return result;
    }

    if (role === 'system') {
      return { role: 'system', content };
    }

    return { role: 'user', content };
  }

  private responseToMessage(responseMessage: OpenAI.Chat.ChatCompletionMessage): Message {
    // Filter to function tool calls only
    const fnToolCalls = (responseMessage.tool_calls ?? []).filter(
      (tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { type: 'function' } =>
        tc.type === 'function'
    );
    let toolCalls: ToolCall[] | undefined;
    if (fnToolCalls.length > 0) {
      toolCalls = fnToolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }
    return {
      role: 'assistant',
      content: responseMessage.content || '',
      ...(toolCalls && { tool_calls: toolCalls }),
    };
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const messages = buildMessagesFromInput(request);
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) =>
      this.toOpenAIMessage(m)
    );

    for (let turn = 0; turn < this._maxTurns; turn++) {
      const response = await this.client.chat.completions.create({
        model: this._model,
        messages: openaiMessages,
        tools: this.toolDefinitions,
      });

      const responseMessage = response.choices[0]?.message;
      if (!responseMessage) break;

      // Filter to function tool calls only
      const fnToolCalls = (responseMessage.tool_calls ?? []).filter(
        (tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { type: 'function' } =>
          tc.type === 'function'
      );

      // Append assistant message to OpenAI messages (with tool_calls intact)
      const assistantParam: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: responseMessage.content || '',
      };
      if (fnToolCalls.length > 0) {
        assistantParam.tool_calls = fnToolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }
      openaiMessages.push(assistantParam);

      // Add assistant message to output
      messages.push(this.responseToMessage(responseMessage));

      // If no tool calls, we're done
      if (fnToolCalls.length === 0) {
        break;
      }

      // Execute each tool call
      for (const tc of fnToolCalls) {
        let toolResult: string;
        try {
          const args: Record<string, unknown> = JSON.parse(tc.function.arguments);
          const tool = this.toolMap.get(tc.function.name);
          if (!tool) throw new Error(`Tool not found: ${tc.function.name}`);
          const toolRequest: ToolRequest = { input: args };
          const result = await tool.call(toolRequest);
          toolResult = JSON.stringify(result.output);
        } catch (e) {
          toolResult = `Error: ${e instanceof Error ? e.message : String(e)}`;
        }

        // Append tool result to OpenAI messages
        openaiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult,
        });

        // Append tool result to output messages
        messages.push({
          role: 'tool',
          content: toolResult,
          tool_call_id: tc.id,
        });
      }
    }

    // Strip undefined fields from messages
    const output = messages.map((m) => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      return msg;
    });

    return { output };
  }
}
