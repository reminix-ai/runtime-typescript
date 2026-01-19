/**
 * Tests for the Anthropic adapter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { InvokeRequest, ChatRequest } from '@reminix/runtime';
import { wrapAgent, serveAgent, AnthropicAdapter } from '../src/adapter.js';

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
  it('should return an AnthropicAdapter', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const adapter = wrapAgent(mockClient as any);

    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it('should accept custom options', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const adapter = wrapAgent(mockClient as any, {
      name: 'my-agent',
      model: 'claude-opus-4-20250514',
    });

    expect(adapter.name).toBe('my-agent');
    expect(adapter.model).toBe('claude-opus-4-20250514');
  });

  it('should use default values if not provided', () => {
    const mockClient = { messages: { create: vi.fn() } };
    const adapter = wrapAgent(mockClient as any);

    expect(adapter.name).toBe('anthropic-agent');
    expect(adapter.model).toBe('claude-sonnet-4-20250514');
  });
});

describe('AnthropicAdapter.invoke', () => {
  it('should call the client', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Hello!' }],
        }),
      },
    };

    const adapter = wrapAgent(mockClient as any);
    const request: InvokeRequest = { input: { prompt: 'Hi' } };

    await adapter.invoke(request);

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

    const adapter = wrapAgent(mockClient as any);
    const request: InvokeRequest = { input: { prompt: 'Hi' } };

    const response = await adapter.invoke(request);

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

    const adapter = wrapAgent(mockClient as any);
    const request: InvokeRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    await adapter.invoke(request);

    expect(mockClient.messages.create).toHaveBeenCalled();
  });
});

describe('AnthropicAdapter.chat', () => {
  it('should call the client', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Hello!' }],
        }),
      },
    };

    const adapter = wrapAgent(mockClient as any);
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    await adapter.chat(request);

    expect(mockClient.messages.create).toHaveBeenCalled();
  });

  it('should return output and messages', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Chat response' }],
        }),
      },
    };

    const adapter = wrapAgent(mockClient as any);
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    const response = await adapter.chat(request);

    expect(response.output).toBe('Chat response');
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].role).toBe('assistant');
    expect(response.messages[1].content).toBe('Chat response');
  });

  it('should extract system message', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Response' }],
        }),
      },
    };

    const adapter = wrapAgent(mockClient as any);
    const request: ChatRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ],
    };

    await adapter.chat(request);

    const callArg = mockClient.messages.create.mock.calls[0][0];
    expect(callArg.system).toBe('You are helpful');
    expect(callArg.messages.every((m: any) => m.role !== 'system')).toBe(true);
  });
});

describe('serveAgent', () => {
  beforeEach(() => {
    vi.mocked(serve).mockClear();
  });

  it('should be callable', () => {
    expect(typeof serveAgent).toBe('function');
  });

  it('should call serve with wrapped adapter', () => {
    const mockClient = { messages: { create: vi.fn() } };

    serveAgent(mockClient as any, { name: 'test-agent' });

    expect(serve).toHaveBeenCalledTimes(1);
    const serveCall = vi.mocked(serve).mock.calls[0][0] as { agents: any[] };
    expect(serveCall.agents).toHaveLength(1);
    expect(serveCall.agents[0]).toBeInstanceOf(AnthropicAdapter);
    expect(serveCall.agents[0].name).toBe('test-agent');
  });

  it('should pass serve options', () => {
    const mockClient = { messages: { create: vi.fn() } };

    serveAgent(mockClient as any, { name: 'test-agent', port: 3000, hostname: 'localhost' });

    const serveCall = vi.mocked(serve).mock.calls[0][0] as { port?: number; hostname?: string };
    expect(serveCall.port).toBe(3000);
    expect(serveCall.hostname).toBe('localhost');
  });
});
