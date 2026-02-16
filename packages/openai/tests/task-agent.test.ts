/**
 * Tests for the OpenAI task agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { OpenAITaskAgent } from '../src/task-agent.js';

const SAMPLE_SCHEMA = {
  type: 'object',
  properties: {
    sentiment: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['sentiment', 'confidence'],
};

describe('OpenAITaskAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAITaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });

    expect(agent).toBeInstanceOf(OpenAITaskAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAITaskAgent(mockClient as any, {
      outputSchema: SAMPLE_SCHEMA,
      name: 'my-task-agent',
      model: 'gpt-4o',
    });

    expect(agent.name).toBe('my-task-agent');
    expect(agent.model).toBe('gpt-4o');
  });

  it('should use default values if not provided', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAITaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });

    expect(agent.name).toBe('openai-task-agent');
    expect(agent.model).toBe('gpt-4o-mini');
  });

  it('should have task type metadata', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAITaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });

    expect(agent.metadata.type).toBe('task');
    expect(agent.metadata.input).toEqual(AGENT_TYPES['task'].input);
    expect(agent.metadata.output).toEqual(AGENT_TYPES['task'].output);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('OpenAITaskAgent.invoke', () => {
  it('should call the client', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"sentiment":"positive","confidence":0.95}' } }],
          }),
        },
      },
    };

    const agent = new OpenAITaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = { input: { task: 'Analyze sentiment' } };

    await agent.invoke(request);

    expect(mockClient.chat.completions.create).toHaveBeenCalled();
  });

  it('should return parsed JSON output', async () => {
    const result = { sentiment: 'positive', confidence: 0.95 };
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(result) } }],
          }),
        },
      },
    };

    const agent = new OpenAITaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = { input: { task: 'Analyze sentiment' } };

    const response = await agent.invoke(request);

    expect(response.output).toEqual(result);
  });

  it('should use json_schema response format', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{}' } }],
          }),
        },
      },
    };

    const agent = new OpenAITaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = { input: { task: 'Do something' } };

    await agent.invoke(request);

    const callArg = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArg.response_format.type).toBe('json_schema');
    expect(callArg.response_format.json_schema.schema).toEqual(SAMPLE_SCHEMA);
  });

  it('should use the configured model', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{}' } }],
          }),
        },
      },
    };

    const agent = new OpenAITaskAgent(mockClient as any, {
      outputSchema: SAMPLE_SCHEMA,
      model: 'gpt-4o',
    });
    const request: AgentRequest = { input: { task: 'Do something' } };

    await agent.invoke(request);

    const callArg = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArg.model).toBe('gpt-4o');
  });

  it('should include extra context in prompt', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{}' } }],
          }),
        },
      },
    };

    const agent = new OpenAITaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = {
      input: { task: 'Analyze', text: 'Hello world', language: 'en' },
    };

    await agent.invoke(request);

    const callArg = mockClient.chat.completions.create.mock.calls[0][0];
    const prompt = callArg.messages[0].content;
    expect(prompt).toContain('Hello world');
    expect(prompt).toContain('language');
  });
});
