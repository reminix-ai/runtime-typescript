/**
 * Google Gemini thread agent for Reminix Runtime.
 */

import type { GoogleGenAI } from '@google/genai';

import {
  Agent,
  AGENT_TYPES,
  type Tool,
  buildMessagesFromInput,
  messageContentToText,
  type AgentRequest,
  type AgentResponse,
  type Message,
  type ToolCall,
  type ToolRequest,
} from '@reminix/runtime';

export interface GoogleThreadAgentOptions {
  tools: Tool[];
  name?: string;
  model?: string;
  maxTokens?: number;
  maxTurns?: number;
  description?: string;
  instructions?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: Record<string, unknown>[];
}

export class GoogleThreadAgent extends Agent {
  private client: GoogleGenAI;
  private toolMap: Map<string, Tool>;
  private functionDeclarations: Record<string, unknown>[];
  private _model: string;
  private _maxTokens: number;
  private _maxTurns: number;

  constructor(client: GoogleGenAI, options: GoogleThreadAgentOptions) {
    super(options.name ?? 'google-thread-agent', {
      description: options.description ?? 'google thread agent',
      streaming: false,
      inputSchema: AGENT_TYPES['thread'].input,
      outputSchema: AGENT_TYPES['thread'].output,
      type: 'thread',
      framework: 'google',
      instructions: options.instructions,
      tags: options.tags,
      metadata: options.metadata,
    });
    this.client = client;
    this.toolMap = new Map(options.tools.map((t) => [t.name, t]));
    this.functionDeclarations = options.tools.map((t) => this.toFunctionDeclaration(t));
    this._model = options.model ?? 'gemini-2.5-flash';
    this._maxTokens = options.maxTokens ?? 4096;
    this._maxTurns = options.maxTurns ?? 10;
  }

  get model(): string {
    return this._model;
  }

  private toFunctionDeclaration(tool: Tool): Record<string, unknown> {
    return {
      name: tool.name,
      description: tool.metadata.description,
      parameters: tool.metadata.inputSchema,
    };
  }

  private extractSystemAndContents(messages: Message[]): {
    system: string | undefined;
    contents: GeminiContent[];
  } {
    let system: string | undefined;
    const contents: GeminiContent[] = [];

    for (const message of messages) {
      const text = messageContentToText(message.content);
      if (message.role === 'system' || message.role === 'developer') {
        system = text;
      } else if (message.role === 'user') {
        contents.push({ role: 'user', parts: [{ text }] });
      } else if (message.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text }] });
      }
    }

    return { system, contents };
  }

  private responseToMessage(response: Record<string, unknown>): Message {
    const candidates = response.candidates as { content: { parts: Record<string, unknown>[] } }[];
    const parts = candidates?.[0]?.content?.parts ?? [];
    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];

    for (const part of parts) {
      if (part.text) {
        textParts.push(part.text as string);
      } else if (part.functionCall) {
        const fc = part.functionCall as { name: string; args: Record<string, unknown> };
        toolCalls.push({
          id: `call_${fc.name}_${Date.now()}`,
          type: 'function',
          function: {
            name: fc.name,
            arguments: JSON.stringify(fc.args),
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
    const { system, contents } = this.extractSystemAndContents(messages);
    const effectiveSystem = this.instructions
      ? system
        ? this.instructions + '\n\n' + system
        : this.instructions
      : system;

    for (let turn = 0; turn < this._maxTurns; turn++) {
      const response = await this.client.models.generateContent({
        model: this._model,
        contents,
        config: {
          ...(effectiveSystem && { systemInstruction: effectiveSystem }),
          maxOutputTokens: this._maxTokens,
          tools: [{ functionDeclarations: this.functionDeclarations }],
        },
      });

      // Convert response to Reminix message and add to output
      const assistantMsg = this.responseToMessage(response as unknown as Record<string, unknown>);
      messages.push(assistantMsg);

      // Append model response to Gemini contents
      const modelContent = (response as unknown as { candidates: { content: GeminiContent }[] })
        .candidates[0].content;
      contents.push(modelContent);

      // Check for function calls
      const functionCallParts = modelContent.parts.filter(
        (p: Record<string, unknown>) => p.functionCall
      );
      if (functionCallParts.length === 0) {
        break;
      }

      // Execute each tool call and collect function responses
      const functionResponseParts: Record<string, unknown>[] = [];
      for (const part of functionCallParts) {
        const fc = (part as { functionCall: { name: string; args: Record<string, unknown> } })
          .functionCall;
        let toolResult: unknown;
        try {
          const tool = this.toolMap.get(fc.name);
          if (!tool) throw new Error(`Tool not found: ${fc.name}`);
          const toolRequest: ToolRequest = { arguments: fc.args };
          const result = await tool.call(toolRequest);
          toolResult = result.output;
        } catch (e) {
          toolResult = { error: e instanceof Error ? e.message : String(e) };
        }

        functionResponseParts.push({
          functionResponse: {
            name: fc.name,
            response: toolResult,
          },
        });

        // Add tool result to output messages
        const callId =
          assistantMsg.tool_calls?.find((tc) => tc.function.name === fc.name)?.id ?? fc.name;
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: callId,
        });
      }

      // Add function responses as user turn for Gemini
      contents.push({ role: 'user', parts: functionResponseParts });
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
