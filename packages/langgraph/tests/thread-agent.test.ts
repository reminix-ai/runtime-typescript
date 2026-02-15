/**
 * Tests for the LangGraph thread agent.
 */

import { describe, it, expect, vi } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { LangGraphThreadAgent } from '../src/thread-agent.js';

describe('LangGraphThreadAgent', () => {
  it('should be instantiable', () => {
    const mockGraph = { invoke: vi.fn() };
    const agent = new LangGraphThreadAgent(mockGraph as any);

    expect(agent).toBeInstanceOf(LangGraphThreadAgent);
  });

  it('should accept a custom name', () => {
    const mockGraph = { invoke: vi.fn() };
    const agent = new LangGraphThreadAgent(mockGraph as any, { name: 'my-custom-agent' });

    expect(agent.name).toBe('my-custom-agent');
  });

  it('should use default name if not provided', () => {
    const mockGraph = { invoke: vi.fn() };
    const agent = new LangGraphThreadAgent(mockGraph as any);

    expect(agent.name).toBe('langgraph-agent');
  });

  it('should have thread type metadata', () => {
    const mockGraph = { invoke: vi.fn() };
    const agent = new LangGraphThreadAgent(mockGraph as any);

    expect(agent.metadata.type).toBe('thread');
    expect(agent.metadata.input).toEqual(AGENT_TYPES['thread'].input);
  });
});

describe('LangGraphThreadAgent.invoke', () => {
  it('should call the graph with the input', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ messages: [new AIMessage({ content: 'Hello!' })] }),
    };

    const agent = new LangGraphThreadAgent(mockGraph as any);
    const request: AgentRequest = { input: { query: 'What is AI?' } };

    await agent.invoke(request);

    expect(mockGraph.invoke).toHaveBeenCalledWith({ query: 'What is AI?' });
  });

  it('should return output from messages in the result', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [new HumanMessage({ content: 'Hello' }), new AIMessage({ content: 'Hi there!' })],
      }),
    };

    const agent = new LangGraphThreadAgent(mockGraph as any);
    const request: AgentRequest = { input: { messages: [] } };

    const response = await agent.invoke(request);

    expect(response.output).toBe('Hi there!');
  });

  it('should handle dict result without messages', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ result: 'success' }),
    };

    const agent = new LangGraphThreadAgent(mockGraph as any);
    const request: AgentRequest = { input: { task: 'compute' } };

    const response = await agent.invoke(request);

    expect(response.output).toEqual({ result: 'success' });
  });

  it('should call graph with state dict format for messages input', async () => {
    const mockGraph = {
      invoke: vi.fn().mockResolvedValue({ messages: [new AIMessage({ content: 'Hello!' })] }),
    };

    const agent = new LangGraphThreadAgent(mockGraph as any);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hi' }] },
    };

    await agent.invoke(request);

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

    const agent = new LangGraphThreadAgent(mockGraph as any);
    const request: AgentRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
      },
    };

    const response = await agent.invoke(request);

    expect(response.output).toBe('Hi!');
  });
});
