/**
 * Tests for the Vercel AI SDK adapter.
 */

import { describe, it, expect, vi } from 'vitest';

import type { InvokeRequest, ChatRequest } from '@reminix/runtime';
import { wrap, VercelAIAdapter } from '../src/adapter.js';

describe('wrap', () => {
  it('should return a VercelAIAdapter', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any);

    expect(adapter).toBeInstanceOf(VercelAIAdapter);
  });

  it('should accept custom options', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any, { name: 'my-agent' });

    expect(adapter.name).toBe('my-agent');
  });

  it('should use default values if not provided', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any);

    expect(adapter.name).toBe('vercel-ai-agent');
  });
});

describe('VercelAIAdapter.invoke', () => {
  it('should call generateText with prompt input', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any);

    // Mock the internal generateText function
    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Hello!' });
    (adapter as any)._generateText = mockGenerateText;

    const request: InvokeRequest = { input: { prompt: 'Hi' } };
    await adapter.invoke(request);

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: mockModel,
      prompt: 'Hi',
    });
  });

  it('should return output', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Hello from Vercel AI!' });
    (adapter as any)._generateText = mockGenerateText;

    const request: InvokeRequest = { input: { prompt: 'Hi' } };
    const response = await adapter.invoke(request);

    expect(response.output).toBe('Hello from Vercel AI!');
  });

  it('should handle messages input by converting to prompt', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Response' });
    (adapter as any)._generateText = mockGenerateText;

    const request: InvokeRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };
    await adapter.invoke(request);

    // Messages are concatenated into a prompt for invoke (stateless)
    expect(mockGenerateText).toHaveBeenCalledWith({
      model: mockModel,
      prompt: 'Hello',
    });
  });
});

describe('VercelAIAdapter.chat', () => {
  it('should call generateText with converted messages', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Hello!' });
    (adapter as any)._generateText = mockGenerateText;

    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };
    await adapter.chat(request);

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: mockModel,
      messages: [{ role: 'user', content: 'Hi' }],
    });
  });

  it('should return output and messages', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Chat response' });
    (adapter as any)._generateText = mockGenerateText;

    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };
    const response = await adapter.chat(request);

    expect(response.output).toBe('Chat response');
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].role).toBe('assistant');
    expect(response.messages[1].content).toBe('Chat response');
  });

  it('should preserve system messages', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrap(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Response' });
    (adapter as any)._generateText = mockGenerateText;

    const request: ChatRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ],
    };
    await adapter.chat(request);

    const callArg = mockGenerateText.mock.calls[0][0];
    expect(callArg.messages).toHaveLength(2);
    expect(callArg.messages[0].role).toBe('system');
  });
});
