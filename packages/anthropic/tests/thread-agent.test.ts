/**
 * Tests for the Anthropic thread agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest, Tool } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { AnthropicThreadAgent } from '../src/thread-agent.js';

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

function makeTextBlock(text = 'Hello!') {
  return { type: 'text' as const, text };
}

function makeToolUseBlock(
  id = 'toolu_1',
  name = 'get_weather',
  input: unknown = { location: 'London' }
) {
  return { type: 'tool_use' as const, id, name, input };
}

function makeResponse(...blocks: unknown[]) {
  return { content: blocks };
}

describe('AnthropicThreadAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool()]);
    expect(agent).toBeInstanceOf(AnthropicThreadAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool()], {
      name: 'my-thread-agent',
      model: 'claude-opus-4-20250514',
      maxTurns: 5,
    });
    expect(agent.name).toBe('my-thread-agent');
    expect(agent.model).toBe('claude-opus-4-20250514');
  });

  it('should use default values if not provided', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool()]);
    expect(agent.name).toBe('anthropic-thread-agent');
    expect(agent.model).toBe('claude-sonnet-4-20250514');
  });

  it('should have thread type metadata', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool()]);
    expect(agent.metadata.type).toBe('thread');
    expect(agent.metadata.input).toEqual(AGENT_TYPES['thread'].input);
    expect(agent.metadata.output).toEqual(AGENT_TYPES['thread'].output);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('AnthropicThreadAgent.invoke', () => {
  it('should return messages when no tool calls', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue(makeResponse(makeTextBlock('Hello!'))),
      },
    };

    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool()]);
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
    const mockClient = {
      messages: {
        create: vi
          .fn()
          .mockResolvedValueOnce(
            makeResponse(
              makeTextBlock('Let me check the weather.'),
              makeToolUseBlock('toolu_1', 'get_weather', { location: 'London' })
            )
          )
          .mockResolvedValueOnce(
            makeResponse(makeTextBlock('The weather in London is sunny, 22°C.'))
          ),
      },
    };

    const tool = makeMockTool();
    const agent = new AnthropicThreadAgent(mockClient as any, [tool]);
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
    const mockClient = {
      messages: {
        create: vi
          .fn()
          .mockResolvedValueOnce(
            makeResponse(makeToolUseBlock('toolu_1', 'get_weather', { location: 'London' }))
          )
          .mockResolvedValueOnce(makeResponse(makeTextBlock("Sorry, I couldn't get the weather."))),
      },
    };

    const tool = makeMockTool();
    (tool.call as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API timeout'));

    const agent = new AnthropicThreadAgent(mockClient as any, [tool]);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Weather?' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    const toolMsg = messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('Error');
  });

  it('should stop after maxTurns iterations', async () => {
    const mockCreate = vi
      .fn()
      .mockResolvedValue(
        makeResponse(makeToolUseBlock('toolu_1', 'get_weather', { location: 'London' }))
      );
    const mockClient = { messages: { create: mockCreate } };

    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool()], { maxTurns: 3 });
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Loop' }] },
    };

    await agent.invoke(request);

    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should use the configured model', async () => {
    const mockCreate = vi.fn().mockResolvedValue(makeResponse(makeTextBlock('Hi')));
    const mockClient = { messages: { create: mockCreate } };

    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool()], {
      model: 'claude-opus-4-20250514',
    });
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.model).toBe('claude-opus-4-20250514');
  });

  it('should pass tool definitions to the client', async () => {
    const mockCreate = vi.fn().mockResolvedValue(makeResponse(makeTextBlock('Hi')));
    const mockClient = { messages: { create: mockCreate } };

    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool('get_weather')]);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.tools).toHaveLength(1);
    expect(callArg.tools[0].name).toBe('get_weather');
  });

  it('should extract system message for Anthropic API', async () => {
    const mockCreate = vi.fn().mockResolvedValue(makeResponse(makeTextBlock('Hi')));
    const mockClient = { messages: { create: mockCreate } };

    const agent = new AnthropicThreadAgent(mockClient as any, [makeMockTool()]);
    const request: AgentRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are a weather assistant.' },
          { role: 'user', content: 'Hi' },
        ],
      },
    };

    await agent.invoke(request);

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.system).toBe('You are a weather assistant.');
  });
});
