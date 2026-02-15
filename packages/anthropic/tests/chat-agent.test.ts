/**
 * Tests for the Anthropic chat agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TEMPLATES } from '@reminix/runtime';
import { AnthropicChatAgent } from '../src/chat-agent.js';

describe('AnthropicChatAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicChatAgent(mockClient as any);

    expect(agent).toBeInstanceOf(AnthropicChatAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicChatAgent(mockClient as any, {
      name: 'my-agent',
      model: 'claude-opus-4-20250514',
    });

    expect(agent.name).toBe('my-agent');
    expect(agent.model).toBe('claude-opus-4-20250514');
  });

  it('should use default values if not provided', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicChatAgent(mockClient as any);

    expect(agent.name).toBe('anthropic-agent');
    expect(agent.model).toBe('claude-sonnet-4-20250514');
  });

  it('should have chat template metadata', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const agent = new AnthropicChatAgent(mockClient as any);

    expect(agent.metadata.template).toBe('chat');
    expect(agent.metadata.input).toEqual(AGENT_TEMPLATES['chat'].input);
  });
});

describe('AnthropicChatAgent.invoke', () => {
  it('should call the client', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Hello!' }],
        }),
      },
    };

    const agent = new AnthropicChatAgent(mockClient as any);
    const request: AgentRequest = { input: { prompt: 'Hi' } };

    await agent.invoke(request);

    expect(mockClient.messages.create).toHaveBeenCalled();
  });

  it('should return output', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Hello from Anthropic!' }],
        }),
      },
    };

    const agent = new AnthropicChatAgent(mockClient as any);
    const request: AgentRequest = { input: { prompt: 'Hi' } };

    const response = await agent.invoke(request);

    expect(response.output).toBe('Hello from Anthropic!');
  });

  it('should handle messages input', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Response' }],
        }),
      },
    };

    const agent = new AnthropicChatAgent(mockClient as any);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    await agent.invoke(request);

    expect(mockClient.messages.create).toHaveBeenCalled();
  });

  it('should extract system message', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Response' }],
        }),
      },
    };

    const agent = new AnthropicChatAgent(mockClient as any);
    const request: AgentRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
        ],
      },
    };

    await agent.invoke(request);

    const callArg = mockClient.messages.create.mock.calls[0][0];
    expect(callArg.system).toBe('You are helpful');
    expect(callArg.messages.every((m: any) => m.role !== 'system')).toBe(true);
  });
});
