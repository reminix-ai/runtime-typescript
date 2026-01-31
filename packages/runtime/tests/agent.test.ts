/**
 * Tests for the callback-based Agent class and factory functions.
 */

import { describe, it, expect } from 'vitest';
import {
  Agent,
  agent,
  chatAgent,
  type AgentInvokeRequest,
  type AgentInvokeResponse,
  type Message,
} from '../src/index.js';

describe('Agent Creation', () => {
  it('should be instantiated with a name', () => {
    const testAgent = new Agent('my-agent');
    expect(testAgent.name).toBe('my-agent');
  });

  it('should accept custom metadata', () => {
    const testAgent = new Agent('my-agent', {
      metadata: { version: '1.0', author: 'test' },
    });
    expect(testAgent.metadata.version).toBe('1.0');
    expect(testAgent.metadata.author).toBe('test');
  });

  it('should have default metadata with capabilities and input/output', () => {
    const testAgent = new Agent('my-agent');
    expect(testAgent.metadata.capabilities).toBeDefined();
    expect(testAgent.metadata.input).toEqual({
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt or task for the agent' },
      },
      required: ['prompt'],
    });
    expect(testAgent.metadata.output).toEqual({ type: 'string' });
  });
});

describe('Agent Handler Registration', () => {
  it('should register invoke handler with handler()', async () => {
    const testAgent = new Agent('test-agent');

    testAgent.handler(async (request) => {
      return { output: 'test' };
    });

    // Handler should be registered (we can test this by calling invoke)
    await expect(testAgent.invoke({ input: { task: 'test' } })).resolves.toEqual({
      output: 'test',
    });
  });

  it('should return this for method chaining', () => {
    const testAgent = new Agent('test-agent');

    const result = testAgent.handler(async () => ({ output: 'invoke' }));

    expect(result).toBe(testAgent);
  });
});

describe('Agent Streaming Flags', () => {
  it('should have streaming false by default', () => {
    const testAgent = new Agent('test-agent');
    expect(testAgent.metadata.capabilities.streaming).toBe(false);
  });

  it('should have streaming true when stream handler registered', () => {
    const testAgent = new Agent('test-agent');

    testAgent.streamHandler(async function* () {
      yield 'test';
    });

    expect(testAgent.metadata.capabilities.streaming).toBe(true);
  });
});

describe('Agent Invoke', () => {
  it('should call registered invoke handler', async () => {
    const testAgent = new Agent('test-agent');

    testAgent.handler(async (request) => {
      const task = (request.input as Record<string, string>).task || 'unknown';
      return { output: `Completed: ${task}` };
    });

    const response = await testAgent.invoke({ input: { task: 'summarize' } });
    expect(response.output).toBe('Completed: summarize');
  });

  it('should throw when no invoke handler registered', async () => {
    const testAgent = new Agent('test-agent');

    await expect(testAgent.invoke({ input: { task: 'test' } })).rejects.toThrow(
      "No invoke handler registered for agent 'test-agent'"
    );
  });
});

describe('Agent Invoke Stream', () => {
  it('should call registered invoke stream handler', async () => {
    const testAgent = new Agent('test-agent');

    testAgent.streamHandler(async function* (request) {
      yield 'Hello';
      yield ' world';
    });

    const chunks: string[] = [];
    for await (const chunk of testAgent.invokeStream({ input: { task: 'test' } })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('should throw when no invoke stream handler registered', async () => {
    const testAgent = new Agent('test-agent');
    const generator = testAgent.invokeStream({ input: { task: 'test' } });

    await expect(generator.next()).rejects.toThrow(
      "No streaming invoke handler registered for agent 'test-agent'"
    );
  });
});

describe('Agent With Context', () => {
  it('should pass context to invoke handler', async () => {
    const testAgent = new Agent('test-agent');
    let receivedContext: Record<string, unknown> | undefined;

    testAgent.handler(async (request) => {
      receivedContext = request.context;
      return { output: 'done' };
    });

    await testAgent.invoke({
      input: { task: 'test' },
      context: { user_id: '123', session: 'abc' },
    });

    expect(receivedContext).toEqual({ user_id: '123', session: 'abc' });
  });
});

describe('Agent toHandler', () => {
  it('should return a fetch handler function', () => {
    const testAgent = new Agent('test-agent');
    const handler = testAgent.toHandler();
    expect(typeof handler).toBe('function');
  });

  it('should handle /health endpoint', async () => {
    const testAgent = new Agent('test-agent');
    const handler = testAgent.toHandler();

    const request = new Request('http://localhost/health');
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('should handle /info endpoint', async () => {
    const testAgent = new Agent('test-agent', {
      metadata: { version: '1.0' },
    });
    const handler = testAgent.toHandler();

    const request = new Request('http://localhost/info');
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.runtime.name).toBe('reminix-runtime');
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].name).toBe('test-agent');
    expect(body.agents[0].version).toBe('1.0');
  });

  it('should handle /agents/{name}/invoke endpoint with input wrapper', async () => {
    const testAgent = new Agent('test-agent');
    testAgent.handler(async (req) => ({
      output: `Received: ${(req.input as Record<string, string>).prompt}`,
    }));
    const handler = testAgent.toHandler();

    // New API uses { input: { ... } }
    const request = new Request('http://localhost/agents/test-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { prompt: 'hello' } }),
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toBe('Received: hello');
  });

  it('should return 404 for wrong agent name', async () => {
    const testAgent = new Agent('test-agent');
    testAgent.handler(async () => ({ output: 'ok' }));
    const handler = testAgent.toHandler();

    const request = new Request('http://localhost/agents/wrong-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { task: 'test' } }),
    });
    const response = await handler(request);

    expect(response.status).toBe(404);
  });

  it('should return 404 for unknown path', async () => {
    const testAgent = new Agent('test-agent');
    const handler = testAgent.toHandler();

    const request = new Request('http://localhost/unknown');
    const response = await handler(request);

    expect(response.status).toBe(404);
  });

  it('should handle CORS preflight', async () => {
    const testAgent = new Agent('test-agent');
    const handler = testAgent.toHandler();

    const request = new Request('http://localhost/health', {
      method: 'OPTIONS',
    });
    const response = await handler(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });
});

// =============================================================================
// Tests for agent() factory function
// =============================================================================

describe('agent() Factory', () => {
  it('should create an Agent instance', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      input: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async ({ a, b }) => (a as number) + (b as number),
    });

    expect(calculator).toBeInstanceOf(Agent);
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
    for await (const chunk of streamer.invokeStream({ input: { text: 'hello world' } })) {
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

// =============================================================================
// Tests for chatAgent() factory function
// =============================================================================

describe('chatAgent() Factory', () => {
  it('should create an Agent instance', () => {
    const bot = chatAgent('bot', {
      description: 'A simple bot',
      handler: async () => [{ role: 'assistant', content: 'Hello!' }],
    });

    expect(bot).toBeInstanceOf(Agent);
    expect(bot.name).toBe('bot');
  });

  it('should set description in metadata', () => {
    const bot = chatAgent('bot', {
      description: 'A helpful assistant',
      handler: async () => [{ role: 'assistant', content: 'Hello!' }],
    });

    expect(bot.metadata.description).toBe('A helpful assistant');
  });

  it('should set standard input schema in metadata', () => {
    const bot = chatAgent('bot', {
      handler: async () => [{ role: 'assistant', content: 'Hello!' }],
    });

    const input = bot.metadata.input as Record<string, unknown>;
    expect(input.type).toBe('object');
    expect(input.properties).toHaveProperty('messages');
    expect(input.required).toContain('messages');
  });

  it('should set standard output schema in metadata', () => {
    const bot = chatAgent('bot', {
      handler: async () => [{ role: 'assistant', content: 'Hello!' }],
    });

    const output = bot.metadata.output as Record<string, unknown>;
    expect(output.type).toBe('object');
    expect(output.properties).toHaveProperty('messages');
    expect(output.required).toContain('messages');
  });

  it('should handle invoke requests with messages input', async () => {
    const echoBot = chatAgent('echo-bot', {
      handler: async (messages) => {
        const lastMsg = messages.at(-1)?.content ?? '';
        return [{ role: 'assistant', content: `You said: ${lastMsg}` }];
      },
    });

    const response = await echoBot.invoke({
      input: { messages: [{ role: 'user', content: 'hello' }] },
    });

    const output = response.output as { messages: Array<{ role: string; content: string }> };
    expect(output.messages[0]).toEqual({
      role: 'assistant',
      content: 'You said: hello',
    });
  });

  it('should pass context to invoke handler', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const bot = chatAgent('bot', {
      handler: async (messages, context) => {
        receivedContext = context;
        return [{ role: 'assistant', content: 'done' }];
      },
    });

    await bot.invoke({
      input: { messages: [{ role: 'user', content: 'hi' }] },
      context: { user_id: '456' },
    });

    expect(receivedContext).toEqual({ user_id: '456' });
  });

  it('should handle streaming with async generator', async () => {
    const streamingBot = chatAgent('streaming-bot', {
      handler: async function* () {
        yield 'Hello';
        yield ' ';
        yield 'world!';
      },
    });

    // Should have streaming enabled
    expect(streamingBot.metadata.capabilities.streaming).toBe(true);

    // Test streaming
    const chunks: string[] = [];
    for await (const chunk of streamingBot.invokeStream({
      input: { messages: [{ role: 'user', content: 'hi' }] },
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' ', 'world!']);
  });

  it('should collect chunks for non-streaming requests', async () => {
    const streamingBot = chatAgent('streaming-bot', {
      handler: async function* () {
        yield 'Hello';
        yield ' ';
        yield 'world!';
      },
    });

    const response = await streamingBot.invoke({
      input: { messages: [{ role: 'user', content: 'hi' }] },
    });

    const output = response.output as { messages: Array<{ role: string; content: string }> };
    expect(output.messages[0]).toEqual({
      role: 'assistant',
      content: 'Hello world!',
    });
  });
});
