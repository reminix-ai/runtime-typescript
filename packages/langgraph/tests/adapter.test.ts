/**
 * Tests for the LangGraph adapter.
 */

import { describe, it, expect, vi } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { InvokeRequest, ChatRequest } from '@reminix/runtime';
import { wrap, LangGraphAdapter } from '../src/adapter.js';

describe('wrap', () => {
  it('should return a LangGraphAdapter', () => {
    const mockGraph = { invoke: vi.fn() };
    const adapter = wrap(mockGraph as any);

    expect(adapter).toBeInstanceOf(LangGraphAdapter);
  });

  it('should accept a custom name', () => {
    const mockGraph = { invoke: vi.fn() };
    const adapter = wrap(mockGraph as any, 'my-custom-agent');

    expect(adapter.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockGraph = { invoke: vi.fn() };
    const adapter = wrap(mockGraph as any);

    expect(adapter.name).toBe('langgraph-agent');
  });
});

describe('LangGraphAdapter.invoke', () => {
  it('should call the graph with the input', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ messages: [new AIMessage({ content: 'Hello!' })] }),
    };

    const adapter = wrap(mockGraph as any);
    const request: InvokeRequest = { input: { query: 'What is AI?' } };

    await adapter.invoke(request);

    expect(mockGraph.invoke).toHaveBeenCalledWith({ query: 'What is AI?' });
  });

  it('should return output from messages in the result', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage({ content: 'Hello' }),
          new AIMessage({ content: 'Hi there!' }),
        ],
      }),
    };

    const adapter = wrap(mockGraph as any);
    const request: InvokeRequest = { input: { messages: [] } };

    const response = await adapter.invoke(request);

    expect(response.output).toBe('Hi there!');
  });

  it('should handle dict result without messages', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ result: 'success' }),
    };

    const adapter = wrap(mockGraph as any);
    const request: InvokeRequest = { input: { task: 'compute' } };

    const response = await adapter.invoke(request);

    expect(response.output).toEqual({ result: 'success' });
  });
});

describe('LangGraphAdapter.chat', () => {
  it('should call the graph with state dict format', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ messages: [new AIMessage({ content: 'Hello!' })] }),
    };

    const adapter = wrap(mockGraph as any);
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    await adapter.chat(request);

    const callArg = mockGraph.invoke.mock.calls[0][0];
    expect(callArg).toHaveProperty('messages');
    expect(callArg.messages).toHaveLength(1);
    expect(callArg.messages[0]).toBeInstanceOf(HumanMessage);
  });

  it('should return output and all messages from the graph', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage({ content: 'Hi' }),
          new AIMessage({ content: 'Hello! How can I help?' }),
        ],
      }),
    };

    const adapter = wrap(mockGraph as any);
    const request: ChatRequest = { messages: [{ role: 'user', content: 'Hi' }] };

    const response = await adapter.chat(request);

    expect(response.output).toBe('Hello! How can I help?');
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].role).toBe('assistant');
  });

  it('should convert messages correctly', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new SystemMessage({ content: 'You are helpful' }),
          new HumanMessage({ content: 'Hello' }),
          new AIMessage({ content: 'Hi!' }),
        ],
      }),
    };

    const adapter = wrap(mockGraph as any);
    const request: ChatRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    };

    const response = await adapter.chat(request);

    expect(response.messages[0].role).toBe('system');
    expect(response.messages[1].role).toBe('user');
    expect(response.messages[2].role).toBe('assistant');
  });
});
