/**
 * Tests for the Vercel AI SDK chat adapter.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TEMPLATES } from '@reminix/runtime';
import { VercelAIChatAgent } from '../src/chat-agent.js';

describe('VercelAIChatAgent', () => {
  it('should be instantiable', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIChatAgent(mockModel as any);

    expect(agent).toBeInstanceOf(VercelAIChatAgent);
  });

  it('should accept custom options', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIChatAgent(mockModel as any, { name: 'my-agent' });

    expect(agent.name).toBe('my-agent');
  });

  it('should use default values if not provided', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIChatAgent(mockModel as any);

    expect(agent.name).toBe('vercel-ai-agent');
  });

  it('should have chat template metadata', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIChatAgent(mockModel as any);

    expect(agent.metadata.template).toBe('chat');
    expect(agent.metadata.input).toEqual(AGENT_TEMPLATES['chat'].input);
  });
});

describe('VercelAIChatAgent.invoke', () => {
  it('should call generateText with prompt input', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIChatAgent(mockModel as any);

    // Mock the internal generateText function
    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Hello!' });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = { input: { prompt: 'Hi' } };
    await agent.invoke(request);

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: mockModel,
      prompt: 'Hi',
    });
  });

  it('should return output', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIChatAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Hello from Vercel AI!' });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = { input: { prompt: 'Hi' } };
    const response = await agent.invoke(request);

    expect(response.output).toBe('Hello from Vercel AI!');
  });

  it('should handle messages input with generateText', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIChatAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Response' });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };
    await agent.invoke(request);

    // Messages are passed directly for chat-style input
    expect(mockGenerateText).toHaveBeenCalledWith({
      model: mockModel,
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should preserve system messages', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAIChatAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Response' });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
        ],
      },
    };
    await agent.invoke(request);

    const callArg = mockGenerateText.mock.calls[0][0];
    expect(callArg.messages).toHaveLength(2);
    expect(callArg.messages[0].role).toBe('system');
  });
});
