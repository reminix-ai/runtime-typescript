/**
 * Tests for the agent() factory function.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { agent, type AgentRequest, type AgentResponse } from '../src/index.js';

describe('agent() Factory', () => {
  it('should create an agent with name and metadata', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      inputSchema: {
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
      inputSchema: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.description).toBe('Add two numbers');
  });

  it('should set inputSchema in metadata', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.inputSchema).toEqual({
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    });
  });

  it('should set outputSchema in metadata when provided', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      outputSchema: { type: 'number' },
      handler: async () => 0,
    });

    expect(calculator.metadata.outputSchema).toEqual({ type: 'number' });
  });

  it('should have default output schema when not provided', () => {
    const calculator = agent('calculator', {
      inputSchema: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.outputSchema).toEqual({ type: 'string' });
  });

  it('should handle invoke requests', async () => {
    const calculator = agent('calculator', {
      inputSchema: {
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
      inputSchema: {
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
      inputSchema: {
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
      inputSchema: {
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

describe('Agent Types', () => {
  it('type prompt: metadata and invoke', async () => {
    const echo = agent('echo', {
      type: 'prompt',
      description: 'Echo the prompt',
      handler: async ({ prompt }) => `You said: ${prompt}`,
    });

    expect(echo.metadata.type).toBe('prompt');
    expect(echo.metadata.inputSchema).toEqual({
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt or task for the agent' },
      },
      required: ['prompt'],
    });
    expect(echo.metadata.outputSchema).toEqual({ type: 'string' });

    const response = await echo.invoke({ input: { prompt: 'hello' } });
    expect(response.output).toBe('You said: hello');
  });

  it('type chat: metadata and invoke', async () => {
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
    expect(chat.metadata.inputSchema?.type).toBe('object');
    expect(chat.metadata.inputSchema?.required).toEqual(['messages']);
    expect(
      (chat.metadata.inputSchema?.properties as Record<string, unknown>)?.messages
    ).toBeDefined();
    expect(chat.metadata.outputSchema).toEqual({ type: 'string' });

    const response = await chat.invoke({
      input: {
        messages: [{ role: 'user', content: 'Hi' }],
      },
    });
    expect(response.output).toBe('Reply to: Hi');
  });

  it('type task: metadata and invoke', async () => {
    const taskAgent = agent('summarizer', {
      type: 'task',
      description: 'Run a task',
      handler: async ({ task, text }) => `Task "${task}" on: ${(text as string) ?? '—'}`,
    });

    expect(taskAgent.metadata.type).toBe('task');
    expect(taskAgent.metadata.inputSchema?.type).toBe('object');
    expect(taskAgent.metadata.inputSchema?.required).toEqual(['task']);
    expect(
      (taskAgent.metadata.inputSchema?.properties as Record<string, unknown>)?.task
    ).toBeDefined();
    expect(taskAgent.metadata.outputSchema?.description).toContain('stateless, single-shot');

    const response = await taskAgent.invoke({
      input: { task: 'summarize', text: 'Some content' },
    });
    expect(response.output).toBe('Task "summarize" on: Some content');
  });

  it('explicit inputSchema overrides type defaults', () => {
    const custom = agent('custom', {
      type: 'prompt',
      inputSchema: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
      },
      handler: async () => 'ok',
    });

    expect(custom.metadata.type).toBe('prompt');
    expect(custom.metadata.inputSchema?.required).toEqual(['q']);
  });

  it('no type or input/output uses default prompt type', () => {
    const def = agent('def', {
      handler: async ({ prompt }) => String(prompt),
    });

    expect(def.metadata.type).toBe('prompt');
    expect(def.metadata.inputSchema?.required).toEqual(['prompt']);
  });

  it('type rag: metadata and invoke', async () => {
    const ragAgent = agent('rag', {
      type: 'rag',
      description: 'Answer from documents',
      handler: async ({ query }) => `Answer for: ${query}`,
    });

    expect(ragAgent.metadata.type).toBe('rag');
    expect(ragAgent.metadata.inputSchema?.required).toEqual(['query']);
    expect(
      (ragAgent.metadata.inputSchema?.properties as Record<string, unknown>)?.query
    ).toBeDefined();
    expect(ragAgent.metadata.outputSchema).toEqual({ type: 'string' });

    const response = await ragAgent.invoke({ input: { query: 'What is X?' } });
    expect(response.output).toBe('Answer for: What is X?');
  });

  it('type thread: metadata and invoke (output is messages)', async () => {
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
    expect(threadAgent.metadata.inputSchema?.required).toEqual(['messages']);
    expect(
      (threadAgent.metadata.inputSchema?.properties as Record<string, unknown>)?.messages
    ).toBeDefined();
    expect(threadAgent.metadata.outputSchema?.type).toBe('array');
    expect((threadAgent.metadata.outputSchema as { items?: unknown })?.items).toBeDefined();

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

  it('type workflow: metadata and invoke', async () => {
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
    const inputSchema = workflowAgent.metadata.inputSchema;
    expect(inputSchema?.required).toEqual(['task']);
    expect((inputSchema?.properties as Record<string, unknown>)?.task).toBeDefined();
    expect((inputSchema?.properties as Record<string, unknown>)?.state).toBeDefined();
    expect((inputSchema?.properties as Record<string, unknown>)?.resume).toBeDefined();
    expect(inputSchema?.additionalProperties).toBe(true);

    const outputSchema = workflowAgent.metadata.outputSchema;
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

// ── Zod Schema Support ──────────────────────────────────────────────────────

describe('Agent with Zod Schema', () => {
  it('should accept Zod input schema and convert to JSON Schema in metadata', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      inputSchema: z.object({
        a: z.number(),
        b: z.number(),
      }),
      handler: async ({ a, b }) => a + b,
    });

    expect(calculator.name).toBe('calculator');
    const meta = calculator.metadata;
    expect(meta.inputSchema.type).toBe('object');
    expect(meta.inputSchema.required).toContain('a');
    expect(meta.inputSchema.required).toContain('b');
  });

  it('should accept Zod output schema', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      outputSchema: z.number(),
      handler: async ({ a, b }) => a + b,
    });

    expect(calculator.metadata.outputSchema).toEqual({ type: 'number' });
  });

  it('should invoke handler correctly with Zod schema', async () => {
    const calculator = agent('calculator', {
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      handler: async ({ a, b }) => a + b,
    });

    const response = await calculator.invoke({ input: { a: 10, b: 20 } });
    expect(response.output).toBe(30);
  });

  it('should validate input by default when Zod schema is used', async () => {
    const myAgent = agent('my-agent', {
      inputSchema: z.object({ name: z.string() }),
      handler: async ({ name }) => `Hello, ${name}!`,
    });

    // Invalid input: name should be string, not number
    await expect(myAgent.invoke({ input: { name: 123 } })).rejects.toThrow();
  });

  it('should skip validation when validate: false', async () => {
    const myAgent = agent('my-agent', {
      inputSchema: z.object({ name: z.string() }),
      validate: false,
      handler: async ({ name }) => `Hello, ${name}!`,
    });

    const response = await myAgent.invoke({ input: { name: 123 } });
    expect(response.output).toBe('Hello, 123!');
  });

  it('should not set a type when Zod input schema is provided without type', () => {
    const myAgent = agent('my-agent', {
      inputSchema: z.object({ x: z.string() }),
      handler: async () => 'ok',
    });

    // When custom inputSchema is provided, no default type should be set
    expect(myAgent.metadata.type).toBeUndefined();
  });

  it('should handle streaming with Zod schema', async () => {
    const streamer = agent('streamer', {
      inputSchema: z.object({ text: z.string() }),
      stream: true,
      handler: async function* ({ text }) {
        for (const word of text.split(' ')) {
          yield word + ' ';
        }
      },
    });

    expect(streamer.metadata.capabilities.streaming).toBe(true);

    const chunks: string[] = [];
    for await (const chunk of streamer.invokeStream!({ input: { text: 'hello world' } })) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['hello ', 'world ']);
  });

  it('should validate input in streaming mode too', async () => {
    const streamer = agent('streamer', {
      inputSchema: z.object({ text: z.string() }),
      stream: true,
      handler: async function* ({ text }) {
        yield text;
      },
    });

    // Streaming invoke with invalid input
    const gen = streamer.invokeStream!({ input: { text: 42 } });
    await expect(async () => {
      for await (const _ of gen) {
        /* consume */
      }
    }).rejects.toThrow();
  });

  it('should preserve original Zod schemas on agent instance', () => {
    const inputZ = z.object({ x: z.number() });
    const outputZ = z.string();
    const myAgent = agent('my-agent', {
      inputSchema: inputZ,
      outputSchema: outputZ,
      handler: async () => 'ok',
    });

    expect(myAgent.inputZodSchema).toBe(inputZ);
    expect(myAgent.outputZodSchema).toBe(outputZ);
  });

  it('should have undefined Zod schemas for JSON Schema agents', () => {
    const myAgent = agent('my-agent', {
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
      handler: async () => 'ok',
    });

    expect(myAgent.inputZodSchema).toBeUndefined();
    expect(myAgent.outputZodSchema).toBeUndefined();
  });
});
