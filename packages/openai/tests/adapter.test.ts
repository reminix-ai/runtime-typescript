/**
 * Tests for the OpenAI adapter.
 */

import { describe, it, expect, vi } from 'vitest';

import { BaseAdapter, type InvokeRequest, type ChatRequest } from '@reminix/runtime';
import { wrap, OpenAIAdapter } from '../src/index.js';

/**
 * Create a mock OpenAI chat completion response.
 */
function createMockResponse(content: string = 'Hello!') {
  return {
    choices: [
      {
        message: {
          role: 'assistant' as const,
          content,
        },
      },
    ],
  };
}

/**
 * Create a mock OpenAI client.
 */
function createMockClient(responseContent: string = 'Hello!') {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(createMockResponse(responseContent)),
      },
    },
  };
}

describe('wrap', () => {
  it('should return an OpenAIAdapter', () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient);

    expect(adapter).toBeInstanceOf(OpenAIAdapter);
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

    expect(adapter.name).toBe('openai-agent');
  });

  it('should accept a model parameter', () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient, { model: 'gpt-4o' });

    expect(adapter.model).toBe('gpt-4o');
  });
});

describe('OpenAIAdapter.invoke', () => {
  it('should call the OpenAI client', async () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await adapter.invoke(request);

    expect(mockClient.chat.completions.create).toHaveBeenCalledOnce();
  });

  it('should pass messages to the client', async () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient, { model: 'gpt-4o' });
    const request: InvokeRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    };

    await adapter.invoke(request);

    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs.model).toBe('gpt-4o');
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[1].role).toBe('user');
  });

  it('should return an InvokeResponse', async () => {
    const mockClient = createMockClient('Hello from OpenAI!');
    const adapter = wrap(mockClient);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.invoke(request);

    expect(response.content).toBe('Hello from OpenAI!');
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

describe('OpenAIAdapter.chat', () => {
  it('should call the OpenAI client', async () => {
    const mockClient = createMockClient();
    const adapter = wrap(mockClient);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await adapter.chat(request);

    expect(mockClient.chat.completions.create).toHaveBeenCalledOnce();
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
