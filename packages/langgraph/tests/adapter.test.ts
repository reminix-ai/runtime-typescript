/**
 * Tests for the LangGraph adapter.
 */

import { describe, it, expect, vi } from 'vitest';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

import { BaseAdapter, type InvokeRequest, type ChatRequest } from '@reminix/runtime';
import { wrap, LangGraphAdapter } from '../src/index.js';

/**
 * Create a mock LangGraph compiled graph.
 */
function createMockGraph(responseContent: string = 'Hello!') {
  return {
    invoke: vi.fn().mockResolvedValue({
      messages: [new AIMessage({ content: responseContent })],
    }),
  };
}

describe('wrap', () => {
  it('should return a LangGraphAdapter', () => {
    const mockGraph = createMockGraph();
    const adapter = wrap(mockGraph);

    expect(adapter).toBeInstanceOf(LangGraphAdapter);
    expect(adapter).toBeInstanceOf(BaseAdapter);
  });

  it('should accept a custom name', () => {
    const mockGraph = createMockGraph();
    const adapter = wrap(mockGraph, 'my-custom-agent');

    expect(adapter.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockGraph = createMockGraph();
    const adapter = wrap(mockGraph);

    expect(adapter.name).toBe('langgraph-agent');
  });
});

describe('LangGraphAdapter.invoke', () => {
  it('should call the underlying graph', async () => {
    const mockGraph = createMockGraph();
    const adapter = wrap(mockGraph);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await adapter.invoke(request);

    expect(mockGraph.invoke).toHaveBeenCalledOnce();
  });

  it('should pass messages in state dict format', async () => {
    const mockGraph = createMockGraph();
    const adapter = wrap(mockGraph);
    const request: InvokeRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    };

    await adapter.invoke(request);

    const callArgs = (mockGraph.invoke as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs).toHaveProperty('messages');
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0]).toBeInstanceOf(SystemMessage);
    expect(callArgs.messages[1]).toBeInstanceOf(HumanMessage);
  });

  it('should return an InvokeResponse', async () => {
    const mockGraph = createMockGraph('Hello from LangGraph!');
    const adapter = wrap(mockGraph);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.invoke(request);

    expect(response.content).toBe('Hello from LangGraph!');
    expect(response.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract content from the last AI message', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage({ content: 'Hello' }),
          new AIMessage({ content: 'First response' }),
          new AIMessage({ content: 'Final response' }),
        ],
      }),
    };
    const adapter = wrap(mockGraph);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const response = await adapter.invoke(request);

    expect(response.content).toBe('Final response');
  });

  it('should include full conversation from graph', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage({ content: 'Hello' }),
          new AIMessage({ content: 'Hi there!' }),
        ],
      }),
    };
    const adapter = wrap(mockGraph);
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const response = await adapter.invoke(request);

    expect(response.messages).toHaveLength(2);
    expect(response.messages[0].role).toBe('user');
    expect(response.messages[1].role).toBe('assistant');
  });
});

describe('LangGraphAdapter.chat', () => {
  it('should call the underlying graph', async () => {
    const mockGraph = createMockGraph();
    const adapter = wrap(mockGraph);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    await adapter.chat(request);

    expect(mockGraph.invoke).toHaveBeenCalledOnce();
  });

  it('should return a ChatResponse', async () => {
    const mockGraph = createMockGraph('Chat response');
    const adapter = wrap(mockGraph);
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.chat(request);

    expect(response.content).toBe('Chat response');
    expect(response.messages.length).toBeGreaterThanOrEqual(1);
  });
});
