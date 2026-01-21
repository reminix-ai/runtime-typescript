/**
 * Tests for the Vercel AI SDK adapter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ExecuteRequest } from '@reminix/runtime';
import { wrapAgent, serveAgent, VercelAIAgentAdapter } from '../src/agent-adapter.js';

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
  it('should return a VercelAIAgentAdapter', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrapAgent(mockModel as any);

    expect(adapter).toBeInstanceOf(VercelAIAgentAdapter);
  });

  it('should accept custom options', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrapAgent(mockModel as any, { name: 'my-agent' });

    expect(adapter.name).toBe('my-agent');
  });

  it('should use default values if not provided', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrapAgent(mockModel as any);

    expect(adapter.name).toBe('vercel-ai-agent');
  });
});

describe('VercelAIAgentAdapter.execute', () => {
  it('should call generateText with prompt input', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrapAgent(mockModel as any);

    // Mock the internal generateText function
    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Hello!' });
    (adapter as any)._generateText = mockGenerateText;

    const request: ExecuteRequest = { input: { prompt: 'Hi' } };
    await adapter.execute(request);

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: mockModel,
      prompt: 'Hi',
    });
  });

  it('should return output', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrapAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Hello from Vercel AI!' });
    (adapter as any)._generateText = mockGenerateText;

    const request: ExecuteRequest = { input: { prompt: 'Hi' } };
    const response = await adapter.execute(request);

    expect(response.output).toBe('Hello from Vercel AI!');
  });

  it('should handle messages input with generateText', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrapAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Response' });
    (adapter as any)._generateText = mockGenerateText;

    const request: ExecuteRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };
    await adapter.execute(request);

    // Messages are passed directly for chat-style input
    expect(mockGenerateText).toHaveBeenCalledWith({
      model: mockModel,
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should preserve system messages', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const adapter = wrapAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Response' });
    (adapter as any)._generateText = mockGenerateText;

    const request: ExecuteRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
        ],
      },
    };
    await adapter.execute(request);

    const callArg = mockGenerateText.mock.calls[0][0];
    expect(callArg.messages).toHaveLength(2);
    expect(callArg.messages[0].role).toBe('system');
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
    const mockModel = { modelId: 'gpt-4o' };

    serveAgent(mockModel as any, { name: 'test-agent' });

    expect(serve).toHaveBeenCalledTimes(1);
    const serveCall = vi.mocked(serve).mock.calls[0][0] as { agents: any[] };
    expect(serveCall.agents).toHaveLength(1);
    expect(serveCall.agents[0]).toBeInstanceOf(VercelAIAgentAdapter);
    expect(serveCall.agents[0].name).toBe('test-agent');
  });

  it('should pass serve options', () => {
    const mockModel = { modelId: 'gpt-4o' };

    serveAgent(mockModel as any, { name: 'test-agent', port: 3000, hostname: 'localhost' });

    const serveCall = vi.mocked(serve).mock.calls[0][0] as { port?: number; hostname?: string };
    expect(serveCall.port).toBe(3000);
    expect(serveCall.hostname).toBe('localhost');
  });
});
