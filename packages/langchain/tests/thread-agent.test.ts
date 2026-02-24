/**
 * Tests for the LangChain thread agent.
 */

import { describe, it, expect, vi } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { LangChainThreadAgent } from '../src/thread-agent.js';

describe('LangChainThreadAgent', () => {
  it('should be instantiable with a Runnable', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainThreadAgent(mockRunnable as any);
    expect(agent).toBeInstanceOf(LangChainThreadAgent);
  });

  it('should be instantiable with a CompiledStateGraph', () => {
    const mockGraph = { invoke: vi.fn(), getGraph: vi.fn() };
    const agent = new LangChainThreadAgent(mockGraph as any);
    expect(agent).toBeInstanceOf(LangChainThreadAgent);
  });

  it('should accept custom options', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainThreadAgent(mockRunnable as any, { name: 'my-thread' });
    expect(agent.name).toBe('my-thread');
  });

  it('should use default values', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainThreadAgent(mockRunnable as any);
    expect(agent.name).toBe('langchain-thread-agent');
  });

  it('should have thread type metadata', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainThreadAgent(mockRunnable as any);
    expect(agent.metadata.type).toBe('thread');
    expect(agent.metadata.inputSchema).toEqual(AGENT_TYPES['thread'].inputSchema);
    expect(agent.metadata.outputSchema).toEqual(AGENT_TYPES['thread'].outputSchema);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('LangChainThreadAgent.invoke with CompiledStateGraph', () => {
  it('should invoke graph with { messages } and convert result', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [new HumanMessage({ content: 'Hello' }), new AIMessage({ content: 'Hi there!' })],
      }),
      getGraph: vi.fn(),
    };

    const agent = new LangChainThreadAgent(mockGraph as any);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hi there!');
  });

  it('should include tool call messages from graph', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage({ content: 'Weather?' }),
          new AIMessage({
            content: '',
            tool_calls: [{ id: 'call_1', name: 'get_weather', args: { city: 'London' } }],
          }),
          new ToolMessage({ content: '22C sunny', tool_call_id: 'call_1' }),
          new AIMessage({ content: 'The weather in London is 22C and sunny.' }),
        ],
      }),
      getGraph: vi.fn(),
    };

    const agent = new LangChainThreadAgent(mockGraph as any);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Weather?' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].tool_calls).toBeDefined();
    expect(messages[2].role).toBe('tool');
    expect(messages[2].tool_call_id).toBe('call_1');
    expect(messages[3].role).toBe('assistant');
    expect(messages[3].content).toBe('The weather in London is 22C and sunny.');
  });
});

describe('LangChainThreadAgent.invoke with Runnable', () => {
  it('should invoke runnable with messages array and wrap result', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: 'Response' })),
    };

    const agent = new LangChainThreadAgent(mockRunnable as any);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    const result = await agent.invoke(request);
    const messages = result.output as Record<string, unknown>[];

    // Should include input messages + response
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[messages.length - 1].role).toBe('assistant');
    expect(messages[messages.length - 1].content).toBe('Response');
  });
});
