/**
 * Tests for the agent() factory function.
 */

import { describe, it, expect } from 'vitest';
import { agent, type AgentRequest, type AgentResponse } from '../src/index.js';

describe('agent() Factory', () => {
  it('should create an agent with name and metadata', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      input: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async ({ a, b }) => (a as number) + (b as number),
    });

    expect(calculator.name).toBe('calculator');
  });

  it('should set description in metadata', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      input: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.description).toBe('Add two numbers');
  });

  it('should set input in metadata', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      input: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.input).toEqual({
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    });
  });

  it('should set output in metadata when provided', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      input: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      output: { type: 'number' },
      handler: async () => 0,
    });

    expect(calculator.metadata.output).toEqual({ type: 'number' });
  });

  it('should have default output schema when not provided', () => {
    const calculator = agent('calculator', {
      input: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.output).toEqual({ type: 'string' });
  });

  it('should handle invoke requests', async () => {
    const calculator = agent('calculator', {
      input: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async ({ a, b }) => (a as number) + (b as number),
    });

    const response = await calculator.invoke({ input: { a: 3, b: 4 } });
    expect(response.output).toBe(7);
  });

  it('should pass context to invoke handler', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const myAgent = agent('my-agent', {
      input: {
        type: 'object',
        properties: { task: { type: 'string' } },
        required: ['task'],
      },
      handler: async (input, context) => {
        receivedContext = context;
        return 'done';
      },
    });

    await myAgent.invoke({
      input: { task: 'test' },
      context: { user_id: '123' },
    });

    expect(receivedContext).toEqual({ user_id: '123' });
  });

  it('should handle streaming with async generator', async () => {
    const streamer = agent('streamer', {
      input: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
      stream: true,
      handler: async function* ({ text }) {
        for (const word of (text as string).split(' ')) {
          yield word + ' ';
        }
      },
    });

    // Should have streaming enabled
    expect(streamer.metadata.capabilities.streaming).toBe(true);

    // Test streaming
    const chunks: string[] = [];
    for await (const chunk of streamer.invokeStream!({ input: { text: 'hello world' } })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['hello ', 'world ']);
  });

  it('should collect chunks for non-streaming requests', async () => {
    const streamer = agent('streamer', {
      input: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
      stream: true,
      handler: async function* ({ text }) {
        for (const word of (text as string).split(' ')) {
          yield word + ' ';
        }
      },
    });

    const response = await streamer.invoke({ input: { text: 'hello world' } });
    expect(response.output).toBe('hello world ');
  });
});

describe('Agent Templates', () => {
  it('template prompt: metadata and invoke', async () => {
    const echo = agent('echo', {
      type: 'prompt',
      description: 'Echo the prompt',
      handler: async ({ prompt }) => `You said: ${prompt}`,
    });

    expect(echo.metadata.type).toBe('prompt');
    expect(echo.metadata.input).toEqual({
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt or task for the agent' },
      },
      required: ['prompt'],
    });
    expect(echo.metadata.output).toEqual({ type: 'string' });

    const response = await echo.invoke({ input: { prompt: 'hello' } });
    expect(response.output).toBe('You said: hello');
  });

  it('template chat: metadata and invoke', async () => {
    const chat = agent('chat', {
      type: 'chat',
      description: 'Reply to messages',
      handler: async ({ messages }) => {
        const last = (messages as Array<{ role: string; content: string }>)[
          (messages as Array<unknown>).length - 1
        ];
        return `Reply to: ${last?.content ?? ''}`;
      },
    });

    expect(chat.metadata.type).toBe('chat');
    expect(chat.metadata.input?.type).toBe('object');
    expect(chat.metadata.input?.required).toEqual(['messages']);
    expect((chat.metadata.input?.properties as Record<string, unknown>)?.messages).toBeDefined();
    expect(chat.metadata.output).toEqual({ type: 'string' });

    const response = await chat.invoke({
      input: {
        messages: [{ role: 'user', content: 'Hi' }],
      },
    });
    expect(response.output).toBe('Reply to: Hi');
  });

  it('template task: metadata and invoke', async () => {
    const taskAgent = agent('summarizer', {
      type: 'task',
      description: 'Run a task',
      handler: async ({ task, text }) => `Task "${task}" on: ${(text as string) ?? '—'}`,
    });

    expect(taskAgent.metadata.type).toBe('task');
    expect(taskAgent.metadata.input?.type).toBe('object');
    expect(taskAgent.metadata.input?.required).toEqual(['task']);
    expect((taskAgent.metadata.input?.properties as Record<string, unknown>)?.task).toBeDefined();
    expect(taskAgent.metadata.output?.description).toContain('stateless, single-shot');

    const response = await taskAgent.invoke({
      input: { task: 'summarize', text: 'Some content' },
    });
    expect(response.output).toBe('Task "summarize" on: Some content');
  });

  it('explicit input overrides template', () => {
    const custom = agent('custom', {
      type: 'prompt',
      input: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
      },
      handler: async () => 'ok',
    });

    expect(custom.metadata.type).toBe('prompt');
    expect(custom.metadata.input?.required).toEqual(['q']);
  });

  it('no template or input/output uses default prompt template', () => {
    const def = agent('def', {
      handler: async ({ prompt }) => String(prompt),
    });

    expect(def.metadata.type).toBe('prompt');
    expect(def.metadata.input?.required).toEqual(['prompt']);
  });

  it('template rag: metadata and invoke', async () => {
    const ragAgent = agent('rag', {
      type: 'rag',
      description: 'Answer from documents',
      handler: async ({ query }) => `Answer for: ${query}`,
    });

    expect(ragAgent.metadata.type).toBe('rag');
    expect(ragAgent.metadata.input?.required).toEqual(['query']);
    expect((ragAgent.metadata.input?.properties as Record<string, unknown>)?.query).toBeDefined();
    expect(ragAgent.metadata.output).toEqual({ type: 'string' });

    const response = await ragAgent.invoke({ input: { query: 'What is X?' } });
    expect(response.output).toBe('Answer for: What is X?');
  });

  it('template thread: metadata and invoke (output is messages)', async () => {
    const threadAgent = agent('thread-agent', {
      type: 'thread',
      description: 'Message thread in, updated thread out',
      handler: async ({ messages }) => {
        const inputMessages = messages as Array<{ role: string; content: string | null }>;
        return [
          ...inputMessages,
          {
            role: 'assistant' as const,
            content: `Reply to: ${inputMessages[inputMessages.length - 1]?.content ?? ''}`,
          },
        ];
      },
    });

    expect(threadAgent.metadata.type).toBe('thread');
    expect(threadAgent.metadata.input?.required).toEqual(['messages']);
    expect(
      (threadAgent.metadata.input?.properties as Record<string, unknown>)?.messages
    ).toBeDefined();
    expect(threadAgent.metadata.output?.type).toBe('array');
    expect((threadAgent.metadata.output as { items?: unknown })?.items).toBeDefined();

    const response = await threadAgent.invoke({
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    });
    const outputMessages = response.output as Array<{ role: string; content: string | null }>;
    expect(Array.isArray(outputMessages)).toBe(true);
    expect(outputMessages).toHaveLength(2);
    expect(outputMessages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(outputMessages[1]?.role).toBe('assistant');
    expect(outputMessages[1]?.content).toBe('Reply to: Hello');
  });

  it('template workflow: metadata and invoke', async () => {
    const workflowAgent = agent('workflow-agent', {
      type: 'workflow',
      description: 'Multi-step workflow',
      handler: async ({ task, steps }) => {
        const inputSteps = (steps as Array<{ name: string }>) || [];
        const executed = inputSteps.map((s) => ({
          name: s.name,
          status: 'completed' as const,
          output: 'ok',
        }));
        return {
          status: 'completed',
          steps: executed,
          result: { summary: `Ran ${executed.length} steps for: ${task}` },
        };
      },
    });

    // Verify metadata
    expect(workflowAgent.metadata.type).toBe('workflow');
    const inputSchema = workflowAgent.metadata.input;
    expect(inputSchema?.required).toEqual(['task']);
    expect((inputSchema?.properties as Record<string, unknown>)?.task).toBeDefined();
    expect((inputSchema?.properties as Record<string, unknown>)?.steps).toBeDefined();
    expect((inputSchema?.properties as Record<string, unknown>)?.resume).toBeDefined();
    expect(inputSchema?.additionalProperties).toBe(true);

    const outputSchema = workflowAgent.metadata.output;
    expect(outputSchema?.required).toEqual(['status', 'steps']);
    expect((outputSchema?.properties as Record<string, { enum?: string[] }>)?.status?.enum).toEqual(
      ['completed', 'failed', 'paused', 'running']
    );
    expect((outputSchema?.properties as Record<string, unknown>)?.steps).toBeDefined();
    expect((outputSchema?.properties as Record<string, unknown>)?.result).toBeDefined();
    expect((outputSchema?.properties as Record<string, unknown>)?.pendingAction).toBeDefined();

    // Verify invoke
    const response = await workflowAgent.invoke({
      input: {
        task: 'process-data',
        steps: [{ name: 'fetch' }, { name: 'transform' }],
      },
    });
    const output = response.output as {
      status: string;
      steps: Array<{ name: string; status: string; output: string }>;
      result: { summary: string };
    };
    expect(output.status).toBe('completed');
    expect(output.steps).toHaveLength(2);
    expect(output.steps[0].name).toBe('fetch');
    expect(output.steps[1].name).toBe('transform');
    expect(output.result.summary).toBe('Ran 2 steps for: process-data');
  });
});
