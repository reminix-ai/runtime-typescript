/**
 * Tests for the OpenAI adapter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { InvokeRequest, ChatRequest } from '@reminix/runtime';
import { wrap, wrapAndServe, OpenAIAdapter } from '../src/adapter.js';

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
  it('should return an OpenAIAdapter', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const adapter = wrap(mockClient as any);

    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });

  it('should accept custom options', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const adapter = wrap(mockClient as any, { name: 'my-agent', model: 'gpt-4o' });

    expect(adapter.name).toBe('my-agent');
    expect(adapter.model).toBe('gpt-4o');
  });

  it('should use default values if not provided', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const adapter = wrap(mockClient as any);

    expect(adapter.name).toBe('openai-agent');
    expect(adapter.model).toBe('gpt-4o-mini');
  });
});

describe('OpenAIAdapter.invoke', () => {
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

    const adapter = wrap(mockClient as any);
    const request: InvokeRequest = { input: { prompt: 'Hi' } };

    await adapter.invoke(request);

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

    const adapter = wrap(mockClient as any);
    const request: InvokeRequest = { input: { prompt: 'Hi' } };

    const response = await adapter.invoke(request);

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

    const adapter = wrap(mockClient as any);
    const request: InvokeRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    await adapter.invoke(request);

    const callArg = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArg.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });
});

describe('OpenAIAdapter.chat', () => {
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

    const adapter = wrap(mockClient as any);
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    await adapter.chat(request);

    expect(mockClient.chat.completions.create).toHaveBeenCalled();
  });

  it('should return output and messages', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Chat response' } }],
          }),
        },
      },
    };

    const adapter = wrap(mockClient as any);
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    const response = await adapter.chat(request);

    expect(response.output).toBe('Chat response');
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].role).toBe('assistant');
    expect(response.messages[1].content).toBe('Chat response');
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

    const adapter = wrap(mockClient as any, { model: 'gpt-4o' });
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    await adapter.chat(request);

    const callArg = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArg.model).toBe('gpt-4o');
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
    const mockClient = { chat: { completions: { create: vi.fn() } } };

    wrapAndServe(mockClient as any, { name: 'test-agent' });

    expect(serve).toHaveBeenCalledTimes(1);
    const serveCall = vi.mocked(serve).mock.calls[0];
    expect(serveCall[0]).toHaveLength(1);
    expect(serveCall[0][0]).toBeInstanceOf(OpenAIAdapter);
    expect(serveCall[0][0].name).toBe('test-agent');
  });

  it('should pass serve options', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };

    wrapAndServe(mockClient as any, { name: 'test-agent', port: 3000, hostname: 'localhost' });

    const serveCall = vi.mocked(serve).mock.calls[0];
    expect(serveCall[1]).toEqual({ port: 3000, hostname: 'localhost' });
  });
});
