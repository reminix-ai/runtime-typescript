/**
 * Vercel AI SDK chat agent for Reminix Runtime.
 *
 * Supports both ToolLoopAgent (for agents with tools) and LanguageModel (for generateText).
 */

import type { ToolLoopAgent } from 'ai';
import { generateText, streamText, type LanguageModel, type ModelMessage } from 'ai';

import {
  AGENT_TYPES,
  messageContentToText,
  buildMessagesFromInput,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
  type Message,
} from '@reminix/runtime';

export interface VercelAIChatAgentOptions {
  name?: string;
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

export class VercelAIChatAgent {
  private modelOrAgent: LanguageModel | AnyToolLoopAgent;
  private isAgent: boolean;
  private _name: string;

  protected _generateText = generateText;
  protected _streamText = streamText;

  constructor(
    modelOrAgent: LanguageModel | AnyToolLoopAgent,
    options: VercelAIChatAgentOptions = {}
  ) {
    this.modelOrAgent = modelOrAgent;
    this.isAgent = isToolLoopAgent(modelOrAgent);
    this._name = options.name ?? 'vercel-ai-agent';
  }

  get name(): string {
    return this._name;
  }

  get metadata(): AgentMetadata {
    return {
      description: 'vercel-ai chat agent',
      capabilities: { streaming: true },
      input: AGENT_TYPES['chat'].input,
      output: AGENT_TYPES['chat'].output,
      framework: 'vercel-ai',
      type: 'chat',
    };
  }

  private toModelMessages(messages: Message[]): ModelMessage[] {
    return messages.map((m) => {
      const role = m.role === 'developer' ? 'system' : m.role;
      if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return { role: 'user' as const, content: messageContentToText(m.content) };
      }
      return {
        role,
        content: messageContentToText(m.content) || '',
      };
    });
  }

  private buildInputFromRequest(request: AgentRequest): {
    prompt?: string;
    messages?: ModelMessage[];
  } {
    const messages = buildMessagesFromInput(request);

    if ('messages' in request.input) {
      return { messages: this.toModelMessages(messages) };
    } else if ('prompt' in request.input) {
      return { prompt: String((request.input as Record<string, unknown>).prompt) };
    } else {
      return { prompt: JSON.stringify(request.input) };
    }
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const { prompt, messages } = this.buildInputFromRequest(request);

    let output: string;

    if (this.isAgent) {
      const agent = this.modelOrAgent as AnyToolLoopAgent;
      const agentInput = prompt ? { prompt, options: {} } : { messages: messages!, options: {} };
      const result = await agent.generate(agentInput);
      output = result.text;
    } else {
      const model = this.modelOrAgent as LanguageModel;
      const result = await this._generateText({
        model,
        ...(prompt ? { prompt } : { messages: messages! }),
      });
      output = result.text;
    }

    return { output };
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    const { prompt, messages } = this.buildInputFromRequest(request);

    if (this.isAgent) {
      const agent = this.modelOrAgent as AnyToolLoopAgent;
      const agentInput = prompt ? { prompt, options: {} } : { messages: messages!, options: {} };
      const result = await agent.stream(agentInput);
      for await (const chunk of result.textStream) {
        yield JSON.stringify({ chunk });
      }
    } else {
      const model = this.modelOrAgent as LanguageModel;
      const result = this._streamText({
        model,
        ...(prompt ? { prompt } : { messages: messages! }),
      });
      for await (const chunk of result.textStream) {
        yield JSON.stringify({ chunk });
      }
    }
  }
}
