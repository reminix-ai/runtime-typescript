/**
 * Tests for the Vercel AI SDK thread agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { VercelAIThreadAgent } from '../src/thread-agent.js';

describe('VercelAIThreadAgent', () => {
  it('should be instantiable with a LanguageModel', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any);
    expect(agent).toBeInstanceOf(VercelAIThreadAgent);
  });

  it('should be instantiable with a ToolLoopAgent', () => {
    const mockAgent = { generate: vi.fn(), stream: vi.fn() };
    const agent = new VercelAIThreadAgent(mockAgent as any);
    expect(agent).toBeInstanceOf(VercelAIThreadAgent);
  });

  it('should accept custom options', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any, {
      name: 'my-thread-agent',
    });
    expect(agent.name).toBe('my-thread-agent');
  });

  it('should use default values if not provided', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any);
    expect(agent.name).toBe('vercel-ai-thread-agent');
  });

  it('should have thread type metadata', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any);
    expect(agent.metadata.type).toBe('thread');
    expect(agent.metadata.inputSchema).toEqual(AGENT_TYPES['thread'].inputSchema);
    expect(agent.metadata.outputSchema).toEqual(AGENT_TYPES['thread'].outputSchema);
    expect(agent.metadata.capabilities.streaming).toBe(true);
  });
});

describe('VercelAIThreadAgent.invoke with LanguageModel', () => {
  it('should call generateText with messages', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: 'Hello!',
      response: {
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
          },
        ],
      },
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const callArg = mockGenerateText.mock.calls[0][0];
    expect(callArg.model).toBe(mockModel);
    expect(callArg.messages).toBeDefined();
  });

  it('should return messages including input and response', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: 'Hello!',
      response: {
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
          },
        ],
      },
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0].role).toBe('user');
    expect(messages[messages.length - 1].role).toBe('assistant');
    expect(messages[messages.length - 1].content).toBe('Hello!');
  });

  it('should include tool call and tool result messages', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: 'The weather in London is sunny, 22°C.',
      response: {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'get_weather',
                input: { location: 'London' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_1',
                toolName: 'get_weather',
                output: { type: 'json', value: { temp: 22, condition: 'sunny' } },
              },
            ],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'The weather in London is sunny, 22°C.' }],
          },
        ],
      },
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: "What's the weather in London?" }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    // user -> assistant(tool_call) -> tool(result) -> assistant(final)
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].tool_calls).toBeDefined();
    expect(messages[2].role).toBe('tool');
    expect(messages[2].tool_call_id).toBe('call_1');
    expect(messages[3].role).toBe('assistant');
    expect(messages[3].content).toBe('The weather in London is sunny, 22°C.');
  });
});

describe('VercelAIThreadAgent.invoke with ToolLoopAgent', () => {
  it('should call agent.generate with messages', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      text: 'Done!',
      response: {
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Done!' }],
          },
        ],
      },
    });
    const mockAgent = { generate: mockGenerate, stream: vi.fn() };
    const agent = new VercelAIThreadAgent(mockAgent as any);

    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Do something' }] },
    };

    await agent.invoke(request);

    expect(mockGenerate).toHaveBeenCalledOnce();
    const callArg = mockGenerate.mock.calls[0][0];
    expect(callArg.messages).toBeDefined();
  });

  it('should return messages from ToolLoopAgent response', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      text: 'Result',
      response: {
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Result' }],
          },
        ],
      },
    });
    const mockAgent = { generate: mockGenerate, stream: vi.fn() };
    const agent = new VercelAIThreadAgent(mockAgent as any);

    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Result');
  });
});

describe('VercelAIThreadAgent.invokeStream', () => {
  it('should yield MessageEvent for each message', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: 'Hello!',
      response: {
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
          },
        ],
      },
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    const events: unknown[] = [];
    for await (const event of agent.invokeStream!(request)) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect((events[0] as any).type).toBe('message');
    expect((events[0] as any).message.role).toBe('user');
    expect((events[events.length - 1] as any).type).toBe('message');
    expect((events[events.length - 1] as any).message.role).toBe('assistant');
  });
});
