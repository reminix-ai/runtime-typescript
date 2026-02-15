/**
 * Tests for the OpenAI thread agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest, ToolLike } from '@reminix/runtime';
import { AGENT_TEMPLATES } from '@reminix/runtime';
import { OpenAIThreadAgent } from '../src/thread-agent.js';

function makeMockTool(
  name = 'get_weather',
  result: unknown = { temp: 22, condition: 'sunny' }
): ToolLike {
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

function makeResponse(content = 'Hello!', toolCalls: unknown[] | null = null) {
  return {
    choices: [
      {
        message: {
          content,
          tool_calls: toolCalls,
        },
      },
    ],
  };
}

function makeToolCall(id = 'call_1', name = 'get_weather', args = '{}') {
  return {
    id,
    type: 'function',
    function: { name, arguments: args },
  };
}

describe('OpenAIThreadAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAIThreadAgent(mockClient as any, [makeMockTool()]);
    expect(agent).toBeInstanceOf(OpenAIThreadAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAIThreadAgent(mockClient as any, [makeMockTool()], {
      name: 'my-thread-agent',
      model: 'gpt-4o',
      maxTurns: 5,
    });
    expect(agent.name).toBe('my-thread-agent');
    expect(agent.model).toBe('gpt-4o');
  });

  it('should use default values if not provided', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAIThreadAgent(mockClient as any, [makeMockTool()]);
    expect(agent.name).toBe('openai-thread-agent');
    expect(agent.model).toBe('gpt-4o-mini');
  });

  it('should have thread template metadata', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAIThreadAgent(mockClient as any, [makeMockTool()]);
    expect(agent.metadata.template).toBe('thread');
    expect(agent.metadata.input).toEqual(AGENT_TEMPLATES['thread'].input);
    expect(agent.metadata.output).toEqual(AGENT_TEMPLATES['thread'].output);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('OpenAIThreadAgent.invoke', () => {
  it('should return messages when no tool calls', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(makeResponse('Hello!')),
        },
      },
    };

    const agent = new OpenAIThreadAgent(mockClient as any, [makeMockTool()]);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[messages.length - 1].role).toBe('assistant');
    expect(messages[messages.length - 1].content).toBe('Hello!');
  });

  it('should execute tool calls and return full thread', async () => {
    const tc = makeToolCall('call_1', 'get_weather', JSON.stringify({ location: 'London' }));
    const mockClient = {
      chat: {
        completions: {
          create: vi
            .fn()
            .mockResolvedValueOnce(makeResponse('', [tc]))
            .mockResolvedValueOnce(makeResponse('The weather in London is sunny, 22°C.')),
        },
      },
    };

    const tool = makeMockTool();
    const agent = new OpenAIThreadAgent(mockClient as any, [tool]);
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
    expect(messages[3].role).toBe('assistant');

    expect(tool.call).toHaveBeenCalledOnce();
  });

  it('should handle tool errors gracefully', async () => {
    const tc = makeToolCall('call_1', 'get_weather', JSON.stringify({ location: 'London' }));
    const mockClient = {
      chat: {
        completions: {
          create: vi
            .fn()
            .mockResolvedValueOnce(makeResponse('', [tc]))
            .mockResolvedValueOnce(makeResponse("Sorry, I couldn't get the weather.")),
        },
      },
    };

    const tool = makeMockTool();
    (tool.call as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API timeout'));

    const agent = new OpenAIThreadAgent(mockClient as any, [tool]);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Weather?' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    const toolMsg = messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('Error');
  });

  it('should stop after maxTurns iterations', async () => {
    const tc = makeToolCall('call_1', 'get_weather', '{}');
    const mockCreate = vi.fn().mockResolvedValue(makeResponse('', [tc]));
    const mockClient = { chat: { completions: { create: mockCreate } } };

    const agent = new OpenAIThreadAgent(mockClient as any, [makeMockTool()], { maxTurns: 3 });
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Loop' }] },
    };

    await agent.invoke(request);

    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should use the configured model', async () => {
    const mockCreate = vi.fn().mockResolvedValue(makeResponse('Hi'));
    const mockClient = { chat: { completions: { create: mockCreate } } };

    const agent = new OpenAIThreadAgent(mockClient as any, [makeMockTool()], { model: 'gpt-4o' });
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.model).toBe('gpt-4o');
  });

  it('should pass tool definitions to the client', async () => {
    const mockCreate = vi.fn().mockResolvedValue(makeResponse('Hi'));
    const mockClient = { chat: { completions: { create: mockCreate } } };

    const agent = new OpenAIThreadAgent(mockClient as any, [makeMockTool('get_weather')]);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.tools).toHaveLength(1);
    expect(callArg.tools[0].type).toBe('function');
    expect(callArg.tools[0].function.name).toBe('get_weather');
  });
});
