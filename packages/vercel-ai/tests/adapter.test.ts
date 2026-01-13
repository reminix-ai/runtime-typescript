/**
 * Tests for the Vercel AI SDK adapter.
 */

import { describe, it, expect, vi } from 'vitest';

import { BaseAdapter, type InvokeRequest, type ChatRequest } from '@reminix/runtime';
import { wrap, VercelAIAdapter } from '../src/index.js';

/**
 * Create a mock Vercel AI model.
 */
function createMockModel() {
  return {
    doGenerate: vi.fn().mockResolvedValue({
      text: 'Hello!',
    }),
  };
}

/**
 * Create a mock generateText function result.
 */
function createMockGenerateResult(content: string = 'Hello!') {
  return {
    text: content,
  };
}

describe('wrap', () => {
  it('should return a VercelAIAdapter', () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel);

    expect(adapter).toBeInstanceOf(VercelAIAdapter);
    expect(adapter).toBeInstanceOf(BaseAdapter);
  });

  it('should accept a custom name', () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel, { name: 'my-custom-agent' });

    expect(adapter.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel);

    expect(adapter.name).toBe('vercel-ai-agent');
  });
});

describe('VercelAIAdapter.invoke', () => {
  it('should call generateText with the model', async () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    // Mock the internal generateText call
    const mockGenerateText = vi.fn().mockResolvedValue(createMockGenerateResult());
    (adapter as any)._generateText = mockGenerateText;

    await adapter.invoke(request);

    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it('should pass messages to generateText', async () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel);
    const request: InvokeRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    };

    const mockGenerateText = vi.fn().mockResolvedValue(createMockGenerateResult());
    (adapter as any)._generateText = mockGenerateText;

    await adapter.invoke(request);

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(2);
  });

  it('should return an InvokeResponse', async () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const mockGenerateText = vi
      .fn()
      .mockResolvedValue(createMockGenerateResult('Hello from Vercel AI!'));
    (adapter as any)._generateText = mockGenerateText;

    const response = await adapter.invoke(request);

    expect(response.content).toBe('Hello from Vercel AI!');
    expect(response.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('should include original messages plus response', async () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const mockGenerateText = vi.fn().mockResolvedValue(createMockGenerateResult('Response'));
    (adapter as any)._generateText = mockGenerateText;

    const response = await adapter.invoke(request);

    expect(response.messages).toHaveLength(2);
    expect(response.messages[0].role).toBe('user');
    expect(response.messages[0].content).toBe('Hello');
    expect(response.messages[1].role).toBe('assistant');
    expect(response.messages[1].content).toBe('Response');
  });
});

describe('VercelAIAdapter.chat', () => {
  it('should call generateText', async () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const mockGenerateText = vi.fn().mockResolvedValue(createMockGenerateResult());
    (adapter as any)._generateText = mockGenerateText;

    await adapter.chat(request);

    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it('should return a ChatResponse', async () => {
    const mockModel = createMockModel();
    const adapter = wrap(mockModel);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const mockGenerateText = vi
      .fn()
      .mockResolvedValue(createMockGenerateResult('Chat response'));
    (adapter as any)._generateText = mockGenerateText;

    const response = await adapter.chat(request);

    expect(response.content).toBe('Chat response');
    expect(response.messages.length).toBeGreaterThanOrEqual(1);
  });
});
