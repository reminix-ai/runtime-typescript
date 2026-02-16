/**
 * Tests for the Google Gemini thread agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest, Tool } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { GoogleThreadAgent } from '../src/thread-agent.js';

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

function makeTextPart(text = 'Hello!') {
  return { text };
}

function makeFunctionCallPart(name = 'get_weather', args: unknown = { location: 'London' }) {
  return { functionCall: { name, args } };
}

function makeResponse(...parts: unknown[]) {
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts,
        },
      },
    ],
  };
}

describe('GoogleThreadAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleThreadAgent(mockClient as any, { tools: [makeMockTool()] });
    expect(agent).toBeInstanceOf(GoogleThreadAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleThreadAgent(mockClient as any, {
      tools: [makeMockTool()],
      name: 'my-thread-agent',
      model: 'gemini-2.5-pro',
      maxTurns: 5,
    });
    expect(agent.name).toBe('my-thread-agent');
    expect(agent.model).toBe('gemini-2.5-pro');
  });

  it('should use default values if not provided', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleThreadAgent(mockClient as any, { tools: [makeMockTool()] });
    expect(agent.name).toBe('google-thread-agent');
    expect(agent.model).toBe('gemini-2.5-flash');
  });

  it('should have thread type metadata', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleThreadAgent(mockClient as any, { tools: [makeMockTool()] });
    expect(agent.metadata.type).toBe('thread');
    expect(agent.metadata.input).toEqual(AGENT_TYPES['thread'].input);
    expect(agent.metadata.output).toEqual(AGENT_TYPES['thread'].output);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('GoogleThreadAgent.invoke', () => {
  it('should return messages when no tool calls', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue(makeResponse(makeTextPart('Hello!'))),
      },
    };

    const agent = new GoogleThreadAgent(mockClient as any, { tools: [makeMockTool()] });
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
      models: {
        generateContent: vi
          .fn()
          .mockResolvedValueOnce(
            makeResponse(
              makeTextPart('Let me check the weather.'),
              makeFunctionCallPart('get_weather', { location: 'London' })
            )
          )
          .mockResolvedValueOnce(
            makeResponse(makeTextPart('The weather in London is sunny, 22°C.'))
          ),
      },
    };

    const tool = makeMockTool();
    const agent = new GoogleThreadAgent(mockClient as any, { tools: [tool] });
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
      models: {
        generateContent: vi
          .fn()
          .mockResolvedValueOnce(
            makeResponse(makeFunctionCallPart('get_weather', { location: 'London' }))
          )
          .mockResolvedValueOnce(makeResponse(makeTextPart("Sorry, I couldn't get the weather."))),
      },
    };

    const tool = makeMockTool();
    (tool.call as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API timeout'));

    const agent = new GoogleThreadAgent(mockClient as any, { tools: [tool] });
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Weather?' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    const toolMsg = messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('error');
  });

  it('should stop after maxTurns iterations', async () => {
    const mockCreate = vi
      .fn()
      .mockResolvedValue(makeResponse(makeFunctionCallPart('get_weather', { location: 'London' })));
    const mockClient = { models: { generateContent: mockCreate } };

    const agent = new GoogleThreadAgent(mockClient as any, {
      tools: [makeMockTool()],
      maxTurns: 3,
    });
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Loop' }] },
    };

    await agent.invoke(request);

    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should use the configured model', async () => {
    const mockCreate = vi.fn().mockResolvedValue(makeResponse(makeTextPart('Hi')));
    const mockClient = { models: { generateContent: mockCreate } };

    const agent = new GoogleThreadAgent(mockClient as any, {
      tools: [makeMockTool()],
      model: 'gemini-2.5-pro',
    });
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-2.5-pro');
  });

  it('should pass tool definitions to the client', async () => {
    const mockCreate = vi.fn().mockResolvedValue(makeResponse(makeTextPart('Hi')));
    const mockClient = { models: { generateContent: mockCreate } };

    const agent = new GoogleThreadAgent(mockClient as any, {
      tools: [makeMockTool('get_weather')],
    });
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.config.tools[0].functionDeclarations).toHaveLength(1);
    expect(callArg.config.tools[0].functionDeclarations[0].name).toBe('get_weather');
  });

  it('should extract system message for Gemini API', async () => {
    const mockCreate = vi.fn().mockResolvedValue(makeResponse(makeTextPart('Hi')));
    const mockClient = { models: { generateContent: mockCreate } };

    const agent = new GoogleThreadAgent(mockClient as any, { tools: [makeMockTool()] });
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
    expect(callArg.config.systemInstruction).toBe('You are a weather assistant.');
  });
});
