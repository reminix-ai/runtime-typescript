/**
 * Tests for the Anthropic adapter.
 */

import { describe, it, expect, vi } from 'vitest';

import { BaseAdapter, type InvokeRequest, type ChatRequest } from '@reminix/runtime';
import { wrap, AnthropicAdapter } from '../src/index.js';

/**
 * Create a mock Anthropic message response.
 */
function createMockResponse(content: string = 'Hello!') {
  return {
    content: [
      {
        type: 'text' as const,
        text: content,
      },
    ],
    role: 'assistant' as const,
  };
}

/**
 * Create a mock Anthropic client.
 */
function createMockClient(responseContent: string = 'Hello!') {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(createMockResponse(responseContent)),
    },
  };
}

describe('wrap', () => {
  it('should return an AnthropicAdapter', () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient);

    expect(adapter).toBeInstanceOf(AnthropicAdapter);
    expect(adapter).toBeInstanceOf(BaseAdapter);
  });

  it('should accept a custom name', () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient, { name: 'my-custom-agent' });

    expect(adapter.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient);

    expect(adapter.name).toBe('anthropic-agent');
  });

  it('should accept a model parameter', () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient, { model: 'claude-sonnet-4-20250514' });

    expect(adapter.model).toBe('claude-sonnet-4-20250514');
  });
});

describe('AnthropicAdapter.invoke', () => {
  it('should call the Anthropic client', async () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await adapter.invoke(request);

    expect(mockClient.messages.create).toHaveBeenCalledOnce();
  });

  it('should pass messages to the client', async () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient, { model: 'claude-sonnet-4-20250514' });
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
    };

    await adapter.invoke(request);

    const callArgs = mockClient.messages.create.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-20250514');
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
  });

  it('should extract system messages and pass separately', async () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient);
    const request: InvokeRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    };

    await adapter.invoke(request);

    const callArgs = mockClient.messages.create.mock.calls[0][0];
    // System message should be passed as 'system' parameter
    expect(callArgs.system).toBe('You are helpful');
    // Only user message should be in messages
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
  });

  it('should return an InvokeResponse', async () => {
    const mockClient = createMockClient('Hello from Anthropic!');
    const adapter = wrap(mockClient);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.invoke(request);

    expect(response.content).toBe('Hello from Anthropic!');
    expect(response.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('should include original messages plus response', async () => {
    const mockClient = createMockClient('Response');
    const adapter = wrap(mockClient);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const response = await adapter.invoke(request);

    expect(response.messages).toHaveLength(2);
    expect(response.messages[0].role).toBe('user');
    expect(response.messages[0].content).toBe('Hello');
    expect(response.messages[1].role).toBe('assistant');
    expect(response.messages[1].content).toBe('Response');
  });
});

describe('AnthropicAdapter.chat', () => {
  it('should call the Anthropic client', async () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await adapter.chat(request);

    expect(mockClient.messages.create).toHaveBeenCalledOnce();
  });

  it('should return a ChatResponse', async () => {
    const mockClient = createMockClient('Chat response');
    const adapter = wrap(mockClient);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.chat(request);

    expect(response.content).toBe('Chat response');
    expect(response.messages.length).toBeGreaterThanOrEqual(1);
  });
});
