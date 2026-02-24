/**
 * Tests for the LangChain chat agent.
 */

import { describe, it, expect, vi } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { LangChainChatAgent } from '../src/chat-agent.js';

describe('LangChainChatAgent', () => {
  it('should be instantiable', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainChatAgent(mockRunnable as any);

    expect(agent).toBeInstanceOf(LangChainChatAgent);
  });

  it('should accept a custom name', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainChatAgent(mockRunnable as any, { name: 'my-custom-agent' });

    expect(agent.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainChatAgent(mockRunnable as any);

    expect(agent.name).toBe('langchain-agent');
  });

  it('should have chat type metadata', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainChatAgent(mockRunnable as any);

    expect(agent.metadata.type).toBe('chat');
    expect(agent.metadata.inputSchema).toEqual(AGENT_TYPES['chat'].inputSchema);
  });
});

describe('LangChainChatAgent.invoke with Runnable', () => {
  it('should call the runnable with the input', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Hello!' })),
    };

    const agent = new LangChainChatAgent(mockRunnable as any);
    const request: AgentRequest = { input: { query: 'What is AI?' } };

    await agent.invoke(request);

    expect(mockRunnable.invoke).toHaveBeenCalledWith({ query: 'What is AI?' });
  });

  it('should return the output from the runnable', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Hello from LangChain!' })),
    };

    const agent = new LangChainChatAgent(mockRunnable as any);
    const request: AgentRequest = { input: { query: 'Hi' } };

    const response = await agent.invoke(request);

    expect(response.output).toBe('Hello from LangChain!');
  });

  it('should handle dict response', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue({ result: 'success', value: 42 }),
    };

    const agent = new LangChainChatAgent(mockRunnable as any);
    const request: AgentRequest = { input: { task: 'compute' } };

    const response = await agent.invoke(request);

    expect(response.output).toEqual({ result: 'success', value: 42 });
  });

  it('should convert messages to LangChain format', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Response' })),
    };

    const agent = new LangChainChatAgent(mockRunnable as any);
    const request: AgentRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
          { role: 'user', content: 'How are you?' },
        ],
      },
    };

    await agent.invoke(request);

    const callArg = mockRunnable.invoke.mock.calls[0][0];
    expect(callArg).toHaveLength(4);
    expect(callArg[0]).toBeInstanceOf(SystemMessage);
    expect(callArg[1]).toBeInstanceOf(HumanMessage);
    expect(callArg[2]).toBeInstanceOf(AIMessage);
    expect(callArg[3]).toBeInstanceOf(HumanMessage);
  });
});

describe('LangChainChatAgent.invoke with CompiledStateGraph', () => {
  it('should detect CompiledStateGraph and wrap input as { messages }', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage({ content: 'Hello' }),
          new AIMessage({ content: 'Hi from graph!' }),
        ],
      }),
      getGraph: vi.fn(),
    };

    const agent = new LangChainChatAgent(mockGraph as any);
    const request: AgentRequest = {
      input: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    };

    const response = await agent.invoke(request);

    // Should wrap as { messages: [...] } for graph
    const callArg = mockGraph.invoke.mock.calls[0][0];
    expect(callArg).toHaveProperty('messages');
    expect(Array.isArray(callArg.messages)).toBe(true);

    // Should extract text from last AI message
    expect(response.output).toBe('Hi from graph!');
  });
});
