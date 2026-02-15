/**
 * Tests for the Anthropic task agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { AnthropicTaskAgent } from '../src/task-agent.js';

const SAMPLE_SCHEMA = {
  type: 'object',
  properties: {
    sentiment: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['sentiment', 'confidence'],
};

describe('AnthropicTaskAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA);

    expect(agent).toBeInstanceOf(AnthropicTaskAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA, {
      name: 'my-task-agent',
      model: 'claude-opus-4-20250514',
    });

    expect(agent.name).toBe('my-task-agent');
    expect(agent.model).toBe('claude-opus-4-20250514');
  });

  it('should use default values if not provided', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA);

    expect(agent.name).toBe('anthropic-task-agent');
    expect(agent.model).toBe('claude-sonnet-4-20250514');
  });

  it('should have task type metadata', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA);

    expect(agent.metadata.type).toBe('task');
    expect(agent.metadata.input).toEqual(AGENT_TYPES['task'].input);
    expect(agent.metadata.output).toEqual(AGENT_TYPES['task'].output);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('AnthropicTaskAgent.invoke', () => {
  it('should call the client', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', input: { sentiment: 'positive', confidence: 0.95 } }],
        }),
      },
    };

    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA);
    const request: AgentRequest = { input: { task: 'Analyze sentiment' } };

    await agent.invoke(request);

    expect(mockClient.messages.create).toHaveBeenCalled();
  });

  it('should return structured output from tool_use block', async () => {
    const result = { sentiment: 'positive', confidence: 0.95 };
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', input: result }],
        }),
      },
    };

    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA);
    const request: AgentRequest = { input: { task: 'Analyze sentiment' } };

    const response = await agent.invoke(request);

    expect(response.output).toEqual(result);
  });

  it('should use tool_choice to force tool use', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', input: {} }],
        }),
      },
    };

    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA);
    const request: AgentRequest = { input: { task: 'Do something' } };

    await agent.invoke(request);

    const callArg = mockClient.messages.create.mock.calls[0][0];
    expect(callArg.tool_choice).toEqual({ type: 'tool', name: 'task_result' });
    expect(callArg.tools).toHaveLength(1);
    expect(callArg.tools[0].name).toBe('task_result');
    expect(callArg.tools[0].input_schema).toEqual(SAMPLE_SCHEMA);
  });

  it('should use the configured model', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', input: {} }],
        }),
      },
    };

    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA, {
      model: 'claude-opus-4-20250514',
    });
    const request: AgentRequest = { input: { task: 'Do something' } };

    await agent.invoke(request);

    const callArg = mockClient.messages.create.mock.calls[0][0];
    expect(callArg.model).toBe('claude-opus-4-20250514');
  });

  it('should include extra context in prompt', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', input: {} }],
        }),
      },
    };

    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA);
    const request: AgentRequest = {
      input: { task: 'Analyze', text: 'Hello world', language: 'en' },
    };

    await agent.invoke(request);

    const callArg = mockClient.messages.create.mock.calls[0][0];
    const prompt = callArg.messages[0].content;
    expect(prompt).toContain('Hello world');
    expect(prompt).toContain('language');
  });

  it('should return empty object if no tool_use block', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Some text' }],
        }),
      },
    };

    const agent = new AnthropicTaskAgent(mockClient as any, SAMPLE_SCHEMA);
    const request: AgentRequest = { input: { task: 'Do something' } };

    const response = await agent.invoke(request);

    expect(response.output).toEqual({});
  });
});
