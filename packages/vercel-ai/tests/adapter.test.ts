/**
 * Tests for the Vercel AI SDK adapter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { InvokeRequest, ChatRequest } from '@reminix/runtime';
import { wrap, wrapAndServe, VercelAIAdapter } from '../src/adapter.js';

// Mock @reminix/runtime serve function
vi.mock('@reminix/runtime', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    serve: vi.fn(),
  };
});

import { serve } from '@reminix/runtime';

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

describe('wrapAndServe', () => {
  beforeEach(() => {
    vi.mocked(serve).mockClear();
  });

  it('should be callable', () => {
    expect(typeof wrapAndServe).toBe('function');
  });

  it('should call serve with wrapped adapter', () => {
    const mockModel = { modelId: 'gpt-4o' };

    wrapAndServe(mockModel as any, { name: 'test-agent' });

    expect(serve).toHaveBeenCalledTimes(1);
    const serveCall = vi.mocked(serve).mock.calls[0];
    expect(serveCall[0]).toHaveLength(1);
    expect(serveCall[0][0]).toBeInstanceOf(VercelAIAdapter);
    expect(serveCall[0][0].name).toBe('test-agent');
  });

  it('should pass serve options', () => {
    const mockModel = { modelId: 'gpt-4o' };

    wrapAndServe(mockModel as any, { name: 'test-agent', port: 3000, hostname: 'localhost' });

    const serveCall = vi.mocked(serve).mock.calls[0];
    expect(serveCall[1]).toEqual({ port: 3000, hostname: 'localhost' });
  });
});
