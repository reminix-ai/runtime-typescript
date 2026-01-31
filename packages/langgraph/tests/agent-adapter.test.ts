/**
 * Tests for the LangGraph adapter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { InvokeRequest } from '@reminix/runtime';
import { wrapAgent, serveAgent, LangGraphAgentAdapter } from '../src/agent-adapter.js';

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
  it('should return a LangGraphAgentAdapter', () => {
    const mockGraph = { invoke: vi.fn() };
    const adapter = wrapAgent(mockGraph as any);

    expect(adapter).toBeInstanceOf(LangGraphAgentAdapter);
  });

  it('should accept a custom name', () => {
    const mockGraph = { invoke: vi.fn() };
    const adapter = wrapAgent(mockGraph as any, 'my-custom-agent');

    expect(adapter.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockGraph = { invoke: vi.fn() };
    const adapter = wrapAgent(mockGraph as any);

    expect(adapter.name).toBe('langgraph-agent');
  });
});

describe('LangGraphAgentAdapter.invoke', () => {
  it('should call the graph with the input', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ messages: [new AIMessage({ content: 'Hello!' })] }),
    };

    const adapter = wrapAgent(mockGraph as any);
    const request: InvokeRequest = { input: { query: 'What is AI?' } };

    await adapter.invoke(request);

    expect(mockGraph.invoke).toHaveBeenCalledWith({ query: 'What is AI?' });
  });

  it('should return output from messages in the result', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [new HumanMessage({ content: 'Hello' }), new AIMessage({ content: 'Hi there!' })],
      }),
    };

    const adapter = wrapAgent(mockGraph as any);
    const request: InvokeRequest = { input: { messages: [] } };

    const response = await adapter.invoke(request);

    expect(response.output).toBe('Hi there!');
  });

  it('should handle dict result without messages', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ result: 'success' }),
    };

    const adapter = wrapAgent(mockGraph as any);
    const request: InvokeRequest = { input: { task: 'compute' } };

    const response = await adapter.invoke(request);

    expect(response.output).toEqual({ result: 'success' });
  });

  it('should call graph with state dict format for messages input', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ messages: [new AIMessage({ content: 'Hello!' })] }),
    };

    const adapter = wrapAgent(mockGraph as any);
    const request: InvokeRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await adapter.invoke(request);

    const callArg = mockGraph.invoke.mock.calls[0][0];
    expect(callArg).toHaveProperty('messages');
    expect(callArg.messages).toHaveLength(1);
    expect(callArg.messages[0]).toBeInstanceOf(HumanMessage);
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

    const adapter = wrapAgent(mockGraph as any);
    const request: InvokeRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
      },
    };

    const response = await adapter.invoke(request);

    // Output should be extracted from last AI message
    expect(response.output).toBe('Hi!');
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
    const mockGraph = { invoke: vi.fn() };

    serveAgent(mockGraph as any, { name: 'test-agent' });

    expect(serve).toHaveBeenCalledTimes(1);
    const serveCall = vi.mocked(serve).mock.calls[0][0] as { agents: any[] };
    expect(serveCall.agents).toHaveLength(1);
    expect(serveCall.agents[0]).toBeInstanceOf(LangGraphAgentAdapter);
    expect(serveCall.agents[0].name).toBe('test-agent');
  });

  it('should pass serve options', () => {
    const mockGraph = { invoke: vi.fn() };

    serveAgent(mockGraph as any, { name: 'test-agent', port: 3000, hostname: 'localhost' });

    const serveCall = vi.mocked(serve).mock.calls[0][0] as { port?: number; hostname?: string };
    expect(serveCall.port).toBe(3000);
    expect(serveCall.hostname).toBe('localhost');
  });
});
