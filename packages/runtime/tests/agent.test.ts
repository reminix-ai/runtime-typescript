/**
 * Tests for the callback-based Agent class and factory functions.
 */

import { describe, it, expect } from 'vitest';
import {
  Agent,
  agent,
  chatAgent,
  type ExecuteRequest,
  type ExecuteResponse,
  type Message,
} from '../src/index.js';

describe('Agent Creation', () => {
  it('should be instantiated with a name', () => {
    const agent = new Agent('my-agent');
    expect(agent.name).toBe('my-agent');
  });

  it('should accept custom metadata', () => {
    const agent = new Agent('my-agent', {
      metadata: { version: '1.0', author: 'test' },
    });
    expect(agent.metadata.type).toBe('agent');
    expect(agent.metadata.version).toBe('1.0');
    expect(agent.metadata.author).toBe('test');
  });

  it('should have default metadata with type, parameters, and keys', () => {
    const agent = new Agent('my-agent');
    expect(agent.metadata.type).toBe('agent');
    expect(agent.metadata.requestKeys).toEqual(['prompt']);
    expect(agent.metadata.responseKeys).toEqual(['content']);
    expect(agent.metadata.parameters).toEqual({
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt or task for the agent' },
      },
      required: ['prompt'],
    });
  });
});

describe('Agent Handler Registration', () => {
  it('should register execute handler with onExecute', async () => {
    const agent = new Agent('test-agent');

    agent.handler(async (request) => {
      return { content: 'test' };
    });

    // Handler should be registered (we can test this by calling execute)
    await expect(agent.execute({ input: { task: 'test' } })).resolves.toEqual({
      content: 'test',
    });
  });

  it('should return this for method chaining', () => {
    const agent = new Agent('test-agent');

    const result = agent.handler(async () => ({ content: 'execute' }));

    expect(result).toBe(agent);
  });
});

describe('Agent Streaming Flags', () => {
  it('should have streaming false by default', () => {
    const agent = new Agent('test-agent');
    expect(agent.streaming).toBe(false);
  });

  it('should have streaming true when handler registered', () => {
    const agent = new Agent('test-agent');

    agent.handlerStream(async function* () {
      yield '{"chunk": "test"}';
    });

    expect(agent.streaming).toBe(true);
  });
});

describe('Agent Execute', () => {
  it('should call registered execute handler', async () => {
    const agent = new Agent('test-agent');

    agent.handler(async (request) => {
      const task = (request.input as Record<string, string>).task || 'unknown';
      return { content: `Completed: ${task}` };
    });

    const response = await agent.execute({ input: { task: 'summarize' } });
    expect(response.content).toBe('Completed: summarize');
  });

  it('should throw when no execute handler registered', async () => {
    const agent = new Agent('test-agent');

    await expect(agent.execute({ input: { task: 'test' } })).rejects.toThrow(
      "No execute handler registered for agent 'test-agent'"
    );
  });
});

describe('Agent Execute Stream', () => {
  it('should call registered execute stream handler', async () => {
    const agent = new Agent('test-agent');

    agent.handlerStream(async function* (request) {
      yield '{"chunk": "Hello"}';
      yield '{"chunk": " world"}';
    });

    const chunks: string[] = [];
    for await (const chunk of agent.executeStream({ input: { task: 'test' } })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['{"chunk": "Hello"}', '{"chunk": " world"}']);
  });

  it('should throw when no execute stream handler registered', async () => {
    const agent = new Agent('test-agent');
    const generator = agent.executeStream({ input: { task: 'test' } });

    await expect(generator.next()).rejects.toThrow(
      "No streaming execute handler registered for agent 'test-agent'"
    );
  });
});

describe('Agent With Context', () => {
  it('should pass context to execute handler', async () => {
    const agent = new Agent('test-agent');
    let receivedContext: Record<string, unknown> | undefined;

    agent.handler(async (request) => {
      receivedContext = request.context;
      return { content: 'done' };
    });

    await agent.execute({
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

  it('should handle /agents/{name}/invoke endpoint with default prompt key', async () => {
    const testAgent = new Agent('test-agent');
    testAgent.handler(async (req) => ({
      content: `Received: ${(req.input as Record<string, string>).prompt}`,
    }));
    const handler = testAgent.toHandler();

    // Default requestKeys is ['prompt'], so send { prompt: '...' }
    const request = new Request('http://localhost/agents/test-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.content).toBe('Received: hello');
  });

  it('should handle /agents/{name}/invoke with custom requestKeys', async () => {
    // Create agent with custom requestKeys via metadata
    const testAgent = new Agent('test-agent', {
      metadata: {
        requestKeys: ['messages'],
        responseKeys: ['content'],
      },
    });
    testAgent.handler(async (req) => {
      const messages = (req.input as { messages: Message[] }).messages;
      return { content: `Reply to: ${messages[0].content}` };
    });
    const handler = testAgent.toHandler();

    // Custom requestKeys: ['messages']
    const request = new Request('http://localhost/agents/test-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.content).toBe('Reply to: hello');
  });

  it('should return 404 for wrong agent name', async () => {
    const testAgent = new Agent('test-agent');
    testAgent.handler(async () => ({ content: 'ok' }));
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
      parameters: {
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
      parameters: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.description).toBe('Add two numbers');
  });

  it('should set parameters in metadata', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.parameters).toEqual({
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    });
  });

  it('should set output in metadata when provided and wrap it', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      parameters: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      output: { type: 'number' },
      handler: async () => 0,
    });

    expect(calculator.metadata.output).toEqual({
      type: 'object',
      properties: { content: { type: 'number' } },
      required: ['content'],
    });
  });

  it('should not include output in metadata when not provided', () => {
    const calculator = agent('calculator', {
      parameters: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.output).toBeUndefined();
  });

  it('should derive requestKeys from parameters.properties', () => {
    const calculator = agent('calculator', {
      parameters: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async () => 0,
    });

    expect(calculator.metadata.requestKeys).toEqual(['a', 'b']);
    expect(calculator.metadata.responseKeys).toEqual(['content']);
  });

  it('should handle execute requests', async () => {
    const calculator = agent('calculator', {
      parameters: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      handler: async ({ a, b }) => (a as number) + (b as number),
    });

    // input contains the extracted keys from request body
    const response = await calculator.execute({ input: { a: 3, b: 4 } });
    expect(response.content).toBe(7);
  });

  it('should pass context to execute handler', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const myAgent = agent('my-agent', {
      parameters: {
        type: 'object',
        properties: { task: { type: 'string' } },
        required: ['task'],
      },
      handler: async (input, context) => {
        receivedContext = context;
        return 'done';
      },
    });

    await myAgent.execute({
      input: { task: 'test' },
      context: { user_id: '123' },
    });

    expect(receivedContext).toEqual({ user_id: '123' });
  });

  it('should handle streaming with async generator', async () => {
    const streamer = agent('streamer', {
      parameters: {
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
    expect(streamer.streaming).toBe(true);

    // Test streaming
    const chunks: string[] = [];
    for await (const chunk of streamer.executeStream({ input: { text: 'hello world' } })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['hello ', 'world ']);
  });

  it('should collect chunks for non-streaming requests', async () => {
    const streamer = agent('streamer', {
      parameters: {
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

    const response = await streamer.execute({ input: { text: 'hello world' } });
    expect(response.content).toBe('hello world ');
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

  it('should set standard parameters schema in metadata', () => {
    const bot = chatAgent('bot', {
      handler: async () => [{ role: 'assistant', content: 'Hello!' }],
    });

    const params = bot.metadata.parameters as Record<string, unknown>;
    expect(params.type).toBe('object');
    expect(params.properties).toHaveProperty('messages');
    expect(params.required).toContain('messages');
  });

  it('should set standard output schema in metadata wrapped for response structure', () => {
    const bot = chatAgent('bot', {
      handler: async () => [{ role: 'assistant', content: 'Hello!' }],
    });

    expect(bot.metadata.output).toEqual({
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['system', 'user', 'assistant', 'tool'],
              },
              content: {
                type: ['string', 'null'],
              },
              name: {
                type: 'string',
              },
              tool_call_id: {
                type: 'string',
              },
              tool_calls: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['function'] },
                    function: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        arguments: { type: 'string' },
                      },
                      required: ['name', 'arguments'],
                    },
                  },
                  required: ['id', 'type', 'function'],
                },
              },
            },
            required: ['role'],
          },
        },
      },
      required: ['messages'],
    });
  });

  it('should handle execute requests with messages input', async () => {
    const echoBot = chatAgent('echo-bot', {
      handler: async (messages) => {
        const lastMsg = messages.at(-1)?.content ?? '';
        return [{ role: 'assistant', content: `You said: ${lastMsg}` }];
      },
    });

    const response = await echoBot.execute({
      input: { messages: [{ role: 'user', content: 'hello' }] },
    });

    expect((response.messages as Array<{ role: string; content: string }>)[0]).toEqual({
      role: 'assistant',
      content: 'You said: hello',
    });
  });

  it('should pass context to execute handler', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const bot = chatAgent('bot', {
      handler: async (messages, context) => {
        receivedContext = context;
        return [{ role: 'assistant', content: 'done' }];
      },
    });

    await bot.execute({
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
    expect(streamingBot.streaming).toBe(true);

    // Test streaming
    const chunks: string[] = [];
    for await (const chunk of streamingBot.executeStream({
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

    const response = await streamingBot.execute({
      input: { messages: [{ role: 'user', content: 'hi' }] },
    });

    expect((response.messages as Array<{ role: string; content: string }>)[0]).toEqual({
      role: 'assistant',
      content: 'Hello world!',
    });
  });
});
