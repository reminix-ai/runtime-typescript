/**
 * Tests for the LangChain task agent.
 */

import { describe, it, expect, vi } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { LangChainTaskAgent } from '../src/task-agent.js';

describe('LangChainTaskAgent', () => {
  it('should be instantiable with a Runnable', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainTaskAgent(mockRunnable as any);
    expect(agent).toBeInstanceOf(LangChainTaskAgent);
  });

  it('should be instantiable with a CompiledStateGraph', () => {
    const mockGraph = { invoke: vi.fn(), getGraph: vi.fn() };
    const agent = new LangChainTaskAgent(mockGraph as any);
    expect(agent).toBeInstanceOf(LangChainTaskAgent);
  });

  it('should accept custom options', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainTaskAgent(mockRunnable as any, { name: 'my-task' });
    expect(agent.name).toBe('my-task');
  });

  it('should use default values', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainTaskAgent(mockRunnable as any);
    expect(agent.name).toBe('langchain-task-agent');
  });

  it('should have task type metadata', () => {
    const mockRunnable = { invoke: vi.fn() };
    const agent = new LangChainTaskAgent(mockRunnable as any);
    expect(agent.metadata.type).toBe('task');
    expect(agent.metadata.inputSchema).toEqual(AGENT_TYPES['task'].inputSchema);
    expect(agent.metadata.outputSchema).toEqual(AGENT_TYPES['task'].outputSchema);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('LangChainTaskAgent.invoke with CompiledStateGraph', () => {
  it('should invoke graph with task as HumanMessage', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage({ content: 'Summarize this' }),
          new AIMessage({ content: '{"summary": "done"}' }),
        ],
      }),
      getGraph: vi.fn(),
    };

    const agent = new LangChainTaskAgent(mockGraph as any);
    const request: AgentRequest = {
      input: { task: 'Summarize this' },
    };

    const result = await agent.invoke(request);

    expect(result.output).toEqual({ summary: 'done' });
  });

  it('should return plain text if last message is not JSON', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage({ content: 'Do it' }),
          new AIMessage({ content: 'Just plain text' }),
        ],
      }),
      getGraph: vi.fn(),
    };

    const agent = new LangChainTaskAgent(mockGraph as any);
    const request: AgentRequest = {
      input: { task: 'Do it' },
    };

    const result = await agent.invoke(request);

    expect(result.output).toBe('Just plain text');
  });
});

describe('LangChainTaskAgent.invoke with Runnable', () => {
  it('should invoke runnable with task prompt', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue(new AIMessage({ content: '{"status": "ok"}' })),
    };

    const agent = new LangChainTaskAgent(mockRunnable as any);
    const request: AgentRequest = {
      input: { task: 'Process data' },
    };

    const result = await agent.invoke(request);

    expect(mockRunnable.invoke).toHaveBeenCalledWith('Process data');
    expect(result.output).toEqual({ status: 'ok' });
  });

  it('should handle dict response from runnable', async () => {
    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue({ result: 'success', count: 3 }),
    };

    const agent = new LangChainTaskAgent(mockRunnable as any);
    const request: AgentRequest = {
      input: { task: 'Count items' },
    };

    const result = await agent.invoke(request);

    expect(result.output).toEqual({ result: 'success', count: 3 });
  });
});
