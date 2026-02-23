/**
 * Tests for the Vercel AI SDK thread agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest, Tool } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { VercelAIThreadAgent } from '../src/thread-agent.js';

function makeMockTool(
  name = 'get_weather',
  result: unknown = { temp: 22, condition: 'sunny' }
): Tool {
  return {
    name,
    metadata: {
      description: `Mock ${name} tool`,
      input: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location'],
      },
      output: { type: 'object' },
    },
    call: vi.fn().mockResolvedValue({ output: result }),
  };
}

describe('VercelAIThreadAgent', () => {
  it('should be instantiable', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any, { tools: [makeMockTool()] });
    expect(agent).toBeInstanceOf(VercelAIThreadAgent);
  });

  it('should accept custom options', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any, {
      tools: [makeMockTool()],
      name: 'my-thread-agent',
      maxTurns: 5,
    });
    expect(agent.name).toBe('my-thread-agent');
  });

  it('should use default values if not provided', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any, { tools: [makeMockTool()] });
    expect(agent.name).toBe('vercel-ai-thread-agent');
  });

  it('should have thread type metadata', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any, { tools: [makeMockTool()] });
    expect(agent.metadata.type).toBe('thread');
    expect(agent.metadata.inputSchema).toEqual(AGENT_TYPES['thread'].inputSchema);
    expect(agent.metadata.outputSchema).toEqual(AGENT_TYPES['thread'].outputSchema);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('VercelAIThreadAgent.invoke', () => {
  it('should call generateText with tools and stopWhen', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const tool = makeMockTool();
    const agent = new VercelAIThreadAgent(mockModel as any, { tools: [tool] });

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
    expect(callArg.tools).toBeDefined();
    expect(callArg.stopWhen).toBeDefined();
  });

  it('should return messages including input and response', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any, { tools: [makeMockTool()] });

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
    const tool = makeMockTool();
    const agent = new VercelAIThreadAgent(mockModel as any, { tools: [tool] });

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

  it('should use custom maxTurns in stopWhen', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIThreadAgent(mockModel as any, {
      tools: [makeMockTool()],
      maxTurns: 5,
    });

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: 'Hi',
      response: {
        messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Hi' }] }],
      },
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    const callArg = mockGenerateText.mock.calls[0][0];
    expect(callArg.stopWhen).toBeDefined();
  });
});
