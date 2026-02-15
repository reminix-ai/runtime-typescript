/**
 * Tests for the OpenAI chat agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentInvokeRequest } from '@reminix/runtime';
import { AGENT_TEMPLATES } from '@reminix/runtime';
import { OpenAIChatAgent } from '../src/chat-agent.js';

describe('OpenAIChatAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAIChatAgent(mockClient as any);

    expect(agent).toBeInstanceOf(OpenAIChatAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAIChatAgent(mockClient as any, { name: 'my-agent', model: 'gpt-4o' });

    expect(agent.name).toBe('my-agent');
    expect(agent.model).toBe('gpt-4o');
  });

  it('should use default values if not provided', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAIChatAgent(mockClient as any);

    expect(agent.name).toBe('openai-agent');
    expect(agent.model).toBe('gpt-4o-mini');
  });

  it('should have chat template metadata', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const agent = new OpenAIChatAgent(mockClient as any);

    expect(agent.metadata.template).toBe('chat');
    expect(agent.metadata.input).toEqual(AGENT_TEMPLATES['chat'].input);
  });
});

describe('OpenAIChatAgent.invoke', () => {
  it('should call the client', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Hello!' } }],
          }),
        },
      },
    };

    const agent = new OpenAIChatAgent(mockClient as any);
    const request: AgentInvokeRequest = { input: { prompt: 'Hi' } };

    await agent.invoke(request);

    expect(mockClient.chat.completions.create).toHaveBeenCalled();
  });

  it('should return output', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Hello from OpenAI!' } }],
          }),
        },
      },
    };

    const agent = new OpenAIChatAgent(mockClient as any);
    const request: AgentInvokeRequest = { input: { prompt: 'Hi' } };

    const response = await agent.invoke(request);

    expect(response.output).toBe('Hello from OpenAI!');
  });

  it('should handle messages input', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Response' } }],
          }),
        },
      },
    };

    const agent = new OpenAIChatAgent(mockClient as any);
    const request: AgentInvokeRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    await agent.invoke(request);

    const callArg = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArg.messages[0].role).toBe('user');
    expect(callArg.messages[0].content).toBe('Hello');
  });

  it('should use the configured model', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Response' } }],
          }),
        },
      },
    };

    const agent = new OpenAIChatAgent(mockClient as any, { model: 'gpt-4o' });
    const request: AgentInvokeRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

    const callArg = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArg.model).toBe('gpt-4o');
  });
});
