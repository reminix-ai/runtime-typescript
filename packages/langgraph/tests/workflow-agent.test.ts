/**
 * Tests for the LangGraph workflow agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { LangGraphWorkflowAgent } from '../src/workflow-agent.js';

function createMockGraph(chunks: Record<string, unknown>[]) {
  return {
    stream: vi.fn().mockReturnValue(
      (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })()
    ),
  };
}

function createInterruptError(value: unknown): Error {
  const error = new Error('GraphInterrupt');
  error.name = 'GraphInterrupt';
  (error as any).interrupts = [{ value }];
  return error;
}

describe('LangGraphWorkflowAgent', () => {
  it('should be instantiable', () => {
    const mockGraph = createMockGraph([]);
    const agent = new LangGraphWorkflowAgent(mockGraph as any);

    expect(agent).toBeInstanceOf(LangGraphWorkflowAgent);
  });

  it('should use default name if not provided', () => {
    const mockGraph = createMockGraph([]);
    const agent = new LangGraphWorkflowAgent(mockGraph as any);

    expect(agent.name).toBe('langgraph-workflow-agent');
  });

  it('should accept a custom name', () => {
    const mockGraph = createMockGraph([]);
    const agent = new LangGraphWorkflowAgent(mockGraph as any, { name: 'my-workflow' });

    expect(agent.name).toBe('my-workflow');
  });

  it('should have workflow type metadata', () => {
    const mockGraph = createMockGraph([]);
    const agent = new LangGraphWorkflowAgent(mockGraph as any);

    expect(agent.metadata.type).toBe('workflow');
    expect(agent.metadata.inputSchema).toEqual(AGENT_TYPES['workflow'].inputSchema);
    expect(agent.metadata.outputSchema).toEqual(AGENT_TYPES['workflow'].outputSchema);
    expect(agent.metadata.framework).toBe('langgraph');
  });
});

describe('LangGraphWorkflowAgent.invoke', () => {
  it('should collect streamed nodes as completed steps', async () => {
    const mockGraph = createMockGraph([
      { fetch_data: { records: 10 } },
      { process: { summary: 'done' } },
    ]);

    const agent = new LangGraphWorkflowAgent(mockGraph as any);
    const request: AgentRequest = { input: { task: 'process data' } };

    const response = await agent.invoke(request);
    const output = response.output as any;

    expect(output.status).toBe('completed');
    expect(output.steps).toHaveLength(2);
    expect(output.steps[0]).toEqual({
      name: 'fetch_data',
      status: 'completed',
      output: { records: 10 },
    });
    expect(output.steps[1]).toEqual({
      name: 'process',
      status: 'completed',
      output: { summary: 'done' },
    });
    expect(output.result).toEqual({ summary: 'done' });
  });

  it('should handle GraphInterrupt with string value', async () => {
    const mockGraph = {
      stream: vi.fn().mockReturnValue(
        (async function* () {
          yield { step1: { data: 'partial' } };
          throw createInterruptError('Please provide approval');
        })()
      ),
    };

    const agent = new LangGraphWorkflowAgent(mockGraph as any);
    const request: AgentRequest = { input: { task: 'approval flow' } };

    const response = await agent.invoke(request);
    const output = response.output as any;

    expect(output.status).toBe('paused');
    expect(output.steps).toHaveLength(1);
    expect(output.steps[0].status).toBe('paused');
    expect(output.pendingAction.step).toBe('step1');
    expect(output.pendingAction.type).toBe('input');
    expect(output.pendingAction.message).toBe('Please provide approval');
  });

  it('should handle GraphInterrupt with dict value containing type/message', async () => {
    const mockGraph = {
      stream: vi.fn().mockReturnValue(
        (async function* () {
          yield { validate: { ok: true } };
          throw createInterruptError({
            type: 'approval',
            message: 'Approve deployment?',
            options: ['yes', 'no'],
          });
        })()
      ),
    };

    const agent = new LangGraphWorkflowAgent(mockGraph as any);
    const request: AgentRequest = { input: { task: 'deploy' } };

    const response = await agent.invoke(request);
    const output = response.output as any;

    expect(output.status).toBe('paused');
    expect(output.pendingAction.type).toBe('approval');
    expect(output.pendingAction.message).toBe('Approve deployment?');
    expect(output.pendingAction.options).toEqual(['yes', 'no']);
  });

  it('should handle GraphInterrupt with non-string non-dict value', async () => {
    const mockGraph = {
      stream: vi.fn().mockReturnValue(
        (async function* () {
          yield* [];
          throw createInterruptError(42);
        })()
      ),
    };

    const agent = new LangGraphWorkflowAgent(mockGraph as any);
    const request: AgentRequest = { input: { task: 'test' } };

    const response = await agent.invoke(request);
    const output = response.output as any;

    expect(output.status).toBe('paused');
    expect(output.pendingAction.type).toBe('input');
    expect(output.pendingAction.message).toBe('42');
  });

  it('should pass Command(resume=...) when request has resume input', async () => {
    const capturedInputs: unknown[] = [];
    const mockGraph = {
      stream: vi.fn().mockImplementation((input: unknown) => {
        capturedInputs.push(input);
        return (async function* () {
          yield { final: { result: 'approved' } };
        })();
      }),
    };

    const agent = new LangGraphWorkflowAgent(mockGraph as any);
    const request: AgentRequest = {
      input: { task: 'deploy', resume: { step: 'approve', input: { approved: true } } },
    };

    const response = await agent.invoke(request);

    expect(capturedInputs).toHaveLength(1);
    // The input should be a Command instance
    const commandInput = capturedInputs[0] as any;
    expect(commandInput.constructor.name).toBe('Command');
    expect((response.output as any).status).toBe('completed');
  });

  it('should set status=failed and mark last step on error', async () => {
    const mockGraph = {
      stream: vi.fn().mockReturnValue(
        (async function* () {
          yield { step1: { partial: true } };
          throw new Error('Graph execution failed');
        })()
      ),
    };

    const agent = new LangGraphWorkflowAgent(mockGraph as any);
    const request: AgentRequest = { input: { task: 'failing task' } };

    const response = await agent.invoke(request);
    const output = response.output as any;

    expect(output.status).toBe('failed');
    expect(output.steps).toHaveLength(1);
    expect(output.steps[0].status).toBe('failed');
    expect(output.error).toBe('Graph execution failed');
  });

  it('should pass thread_id from context to graph config', async () => {
    const mockGraph = {
      stream: vi.fn().mockReturnValue(
        (async function* () {
          yield { node1: { ok: true } };
        })()
      ),
    };

    const agent = new LangGraphWorkflowAgent(mockGraph as any);
    const request: AgentRequest = {
      input: { task: 'test' },
      context: { thread_id: 'thread-123' },
    };

    await agent.invoke(request);

    expect(mockGraph.stream).toHaveBeenCalledWith(
      { task: 'test' },
      { configurable: { thread_id: 'thread-123' } }
    );
  });

  it('should pass empty config when no context is provided', async () => {
    const mockGraph = {
      stream: vi.fn().mockReturnValue(
        (async function* () {
          yield { node1: { ok: true } };
        })()
      ),
    };

    const agent = new LangGraphWorkflowAgent(mockGraph as any);
    const request: AgentRequest = { input: { task: 'test' } };

    await agent.invoke(request);

    expect(mockGraph.stream).toHaveBeenCalledWith({ task: 'test' }, {});
  });
});
