/**
 * Tests for the LangChain adapter.
 */

import { describe, it, expect, vi } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { InvokeRequest, ChatRequest } from '@reminix/runtime';
import { wrap, LangChainAdapter } from '../src/adapter.js';

describe('wrap', () => {
  it('should return a LangChainAdapter', () => {
    const mockRunnable = { invoke: vi.fn() };
    const adapter = wrap(mockRunnable as any);

    expect(adapter).toBeInstanceOf(LangChainAdapter);
  });

  it('should accept a custom name', () => {
    const mockRunnable = { invoke: vi.fn() };
    const adapter = wrap(mockRunnable as any, 'my-custom-agent');

    expect(adapter.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockRunnable = { invoke: vi.fn() };
    const adapter = wrap(mockRunnable as any);

    expect(adapter.name).toBe('langchain-agent');
  });
});

describe('LangChainAdapter.invoke', () => {
  it('should call the runnable with the input', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Hello!' })),
    };

    const adapter = wrap(mockRunnable as any);
    const request: InvokeRequest = { input: { query: 'What is AI?' } };

    await adapter.invoke(request);

    expect(mockRunnable.invoke).toHaveBeenCalledWith({ query: 'What is AI?' });
  });

  it('should return the output from the runnable', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Hello from LangChain!' })),
    };

    const adapter = wrap(mockRunnable as any);
    const request: InvokeRequest = { input: { query: 'Hi' } };

    const response = await adapter.invoke(request);

    expect(response.output).toBe('Hello from LangChain!');
  });

  it('should handle dict response', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue({ result: 'success', value: 42 }),
    };

    const adapter = wrap(mockRunnable as any);
    const request: InvokeRequest = { input: { task: 'compute' } };

    const response = await adapter.invoke(request);

    expect(response.output).toEqual({ result: 'success', value: 42 });
  });
});

describe('LangChainAdapter.chat', () => {
  it('should call the runnable with converted messages', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Hello!' })),
    };

    const adapter = wrap(mockRunnable as any);
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    await adapter.chat(request);

    expect(mockRunnable.invoke).toHaveBeenCalled();
    const callArg = mockRunnable.invoke.mock.calls[0][0];
    expect(callArg).toHaveLength(1);
    expect(callArg[0]).toBeInstanceOf(HumanMessage);
  });

  it('should convert messages to LangChain format', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Response' })),
    };

    const adapter = wrap(mockRunnable as any);
    const request: ChatRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ],
    };

    await adapter.chat(request);

    const callArg = mockRunnable.invoke.mock.calls[0][0];
    expect(callArg).toHaveLength(4);
    expect(callArg[0]).toBeInstanceOf(SystemMessage);
    expect(callArg[1]).toBeInstanceOf(HumanMessage);
    expect(callArg[2]).toBeInstanceOf(AIMessage);
    expect(callArg[3]).toBeInstanceOf(HumanMessage);
  });

  it('should return output and messages', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Chat response' })),
    };

    const adapter = wrap(mockRunnable as any);
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    const response = await adapter.chat(request);

    expect(response.output).toBe('Chat response');
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].role).toBe('assistant');
    expect(response.messages[1].content).toBe('Chat response');
  });
});
