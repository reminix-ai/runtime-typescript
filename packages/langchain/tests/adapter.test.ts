/**
 * Tests for the LangChain adapter.
 */

import { describe, it, expect, vi } from 'vitest';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';

import { BaseAdapter, type InvokeRequest, type ChatRequest } from '@reminix/runtime';
import { wrap, LangChainAdapter } from '../src/index.js';

/**
 * Create a mock LangChain runnable.
 */
function createMockRunnable(response: string = 'Hello!') {
  return {
    invoke: vi.fn().mockResolvedValue(new AIMessage({ content: response })),
  } as unknown as Runnable;
}

describe('wrap', () => {
  it('should return a LangChainAdapter', () => {
    const mockRunnable = createMockRunnable();
    const adapter = wrap(mockRunnable);

    expect(adapter).toBeInstanceOf(LangChainAdapter);
    expect(adapter).toBeInstanceOf(BaseAdapter);
  });

  it('should accept a custom name', () => {
    const mockRunnable = createMockRunnable();
    const adapter = wrap(mockRunnable, 'my-custom-agent');

    expect(adapter.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockRunnable = createMockRunnable();
    const adapter = wrap(mockRunnable);

    expect(adapter.name).toBe('langchain-agent');
  });
});

describe('LangChainAdapter.invoke', () => {
  it('should call the underlying runnable', async () => {
    const mockRunnable = createMockRunnable();
    const adapter = wrap(mockRunnable);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await adapter.invoke(request);

    expect(mockRunnable.invoke).toHaveBeenCalledOnce();
  });

  it('should convert messages to LangChain format', async () => {
    const mockRunnable = createMockRunnable();
    const adapter = wrap(mockRunnable);
    const request: InvokeRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ],
    };

    await adapter.invoke(request);

    const callArgs = (mockRunnable.invoke as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs).toHaveLength(4);
    expect(callArgs[0]).toBeInstanceOf(SystemMessage);
    expect(callArgs[1]).toBeInstanceOf(HumanMessage);
    expect(callArgs[2]).toBeInstanceOf(AIMessage);
    expect(callArgs[3]).toBeInstanceOf(HumanMessage);
  });

  it('should return an InvokeResponse', async () => {
    const mockRunnable = createMockRunnable('Hello from LangChain!');
    const adapter = wrap(mockRunnable);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.invoke(request);

    expect(response.content).toBe('Hello from LangChain!');
    expect(response.messages.length).toBeGreaterThanOrEqual(1);
    expect(response.messages[response.messages.length - 1].role).toBe('assistant');
    expect(response.messages[response.messages.length - 1].content).toBe('Hello from LangChain!');
  });

  it('should include original messages plus response', async () => {
    const mockRunnable = createMockRunnable('Response');
    const adapter = wrap(mockRunnable);
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

describe('LangChainAdapter.chat', () => {
  it('should call the underlying runnable', async () => {
    const mockRunnable = createMockRunnable();
    const adapter = wrap(mockRunnable);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await adapter.chat(request);

    expect(mockRunnable.invoke).toHaveBeenCalledOnce();
  });

  it('should return a ChatResponse', async () => {
    const mockRunnable = createMockRunnable('Chat response');
    const adapter = wrap(mockRunnable);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.chat(request);

    expect(response.content).toBe('Chat response');
    expect(response.messages.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Message conversion', () => {
  it('should handle tool role messages', async () => {
    const mockRunnable = createMockRunnable('Response');
    const adapter = wrap(mockRunnable);
    const request: InvokeRequest = {
      messages: [
        { role: 'user', content: 'Use a tool' },
        { role: 'tool', content: 'Tool result' },
      ],
    };

    // Should not throw an error
    const response = await adapter.invoke(request);
    expect(response.content).toBe('Response');
  });
});
