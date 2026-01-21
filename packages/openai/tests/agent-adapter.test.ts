/**
 * Tests for the OpenAI adapter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ExecuteRequest } from '@reminix/runtime';
import { wrapAgent, serveAgent, OpenAIAgentAdapter } from '../src/agent-adapter.js';

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
  it('should return an OpenAIAgentAdapter', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const adapter = wrapAgent(mockClient as any);

    expect(adapter).toBeInstanceOf(OpenAIAgentAdapter);
  });

  it('should accept custom options', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const adapter = wrapAgent(mockClient as any, { name: 'my-agent', model: 'gpt-4o' });

    expect(adapter.name).toBe('my-agent');
    expect(adapter.model).toBe('gpt-4o');
  });

  it('should use default values if not provided', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };
    const adapter = wrapAgent(mockClient as any);

    expect(adapter.name).toBe('openai-agent');
    expect(adapter.model).toBe('gpt-4o-mini');
  });
});

describe('OpenAIAgentAdapter.execute', () => {
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

    const adapter = wrapAgent(mockClient as any);
    const request: ExecuteRequest = { input: { prompt: 'Hi' } };

    await adapter.execute(request);

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

    const adapter = wrapAgent(mockClient as any);
    const request: ExecuteRequest = { input: { prompt: 'Hi' } };

    const response = await adapter.execute(request);

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

    const adapter = wrapAgent(mockClient as any);
    const request: ExecuteRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    await adapter.execute(request);

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

    const adapter = wrapAgent(mockClient as any, { model: 'gpt-4o' });
    const request: ExecuteRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await adapter.execute(request);

    const callArg = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArg.model).toBe('gpt-4o');
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
    const mockClient = { chat: { completions: { create: vi.fn() } } };

    serveAgent(mockClient as any, { name: 'test-agent' });

    expect(serve).toHaveBeenCalledTimes(1);
    const serveCall = vi.mocked(serve).mock.calls[0][0] as { agents: any[] };
    expect(serveCall.agents).toHaveLength(1);
    expect(serveCall.agents[0]).toBeInstanceOf(OpenAIAgentAdapter);
    expect(serveCall.agents[0].name).toBe('test-agent');
  });

  it('should pass serve options', () => {
    const mockClient = { chat: { completions: { create: vi.fn() } } };

    serveAgent(mockClient as any, { name: 'test-agent', port: 3000, hostname: 'localhost' });

    const serveCall = vi.mocked(serve).mock.calls[0][0] as { port?: number; hostname?: string };
    expect(serveCall.port).toBe(3000);
    expect(serveCall.hostname).toBe('localhost');
  });
});
