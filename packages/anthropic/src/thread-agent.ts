/**
 * Anthropic thread agent for Reminix Runtime.
 */

import type Anthropic from '@anthropic-ai/sdk';

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

export interface AnthropicThreadAgentOptions {
  name?: string;
  model?: string;
  maxTokens?: number;
  maxTurns?: number;
}

export class AnthropicThreadAgent {
  private client: Anthropic;
  private toolMap: Map<string, ToolLike>;
  private toolDefinitions: Anthropic.Tool[];
  private _name: string;
  private _model: string;
  private _maxTokens: number;
  private _maxTurns: number;

  constructor(client: Anthropic, tools: ToolLike[], options: AnthropicThreadAgentOptions = {}) {
    this.client = client;
    this.toolMap = new Map(tools.map((t) => [t.name, t]));
    this.toolDefinitions = tools.map((t) => this.toAnthropicTool(t));
    this._name = options.name ?? 'anthropic-thread-agent';
    this._model = options.model ?? 'claude-sonnet-4-20250514';
    this._maxTokens = options.maxTokens ?? 4096;
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
      description: 'anthropic thread agent',
      capabilities: { streaming: false },
      input: AGENT_TEMPLATES['thread'].input,
      output: AGENT_TEMPLATES['thread'].output,
      adapter: 'anthropic',
      template: 'thread',
    };
  }

  private toAnthropicTool(tool: ToolLike): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.metadata.description,
      input_schema: tool.metadata.input as Anthropic.Tool['input_schema'],
    };
  }

  private extractSystemAndMessages(messages: Message[]): {
    system: string | undefined;
    messages: Anthropic.MessageParam[];
  } {
    let system: string | undefined;
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const message of messages) {
      const text = messageContentToText(message.content);
      if (message.role === 'system' || message.role === 'developer') {
        system = text;
      } else if (message.role === 'user' || message.role === 'assistant') {
        anthropicMessages.push({ role: message.role, content: text });
      }
    }

    return { system, messages: anthropicMessages };
  }

  private responseToMessage(response: Anthropic.Message): Message {
    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      role: 'assistant',
      content: textParts.join(' ') || '',
      ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
    };
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const messages = buildMessagesFromInput(request);
    const { system, messages: anthropicMessages } = this.extractSystemAndMessages(messages);

    for (let turn = 0; turn < this._maxTurns; turn++) {
      const response = await this.client.messages.create({
        model: this._model,
        max_tokens: this._maxTokens,
        messages: anthropicMessages,
        tools: this.toolDefinitions,
        ...(system && { system }),
      });

      // Convert response to Reminix message and add to output
      const assistantMsg = this.responseToMessage(response);
      messages.push(assistantMsg);

      // Append assistant response to Anthropic messages
      anthropicMessages.push({ role: 'assistant', content: response.content });

      // Check for tool_use blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      if (toolUseBlocks.length === 0) {
        break;
      }

      // Execute each tool call and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        let toolResult: string;
        try {
          const tool = this.toolMap.get(block.name);
          if (!tool) throw new Error(`Tool not found: ${block.name}`);
          const toolRequest: ToolRequest = { input: block.input as Record<string, unknown> };
          const result = await tool.call(toolRequest);
          toolResult = JSON.stringify(result.output);
        } catch (e) {
          toolResult = `Error: ${e instanceof Error ? e.message : String(e)}`;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: toolResult,
        });

        // Add tool result to output messages
        messages.push({
          role: 'tool',
          content: toolResult,
          tool_call_id: block.id,
        });
      }

      // Add tool results as a user message for Anthropic
      anthropicMessages.push({ role: 'user', content: toolResults });
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
