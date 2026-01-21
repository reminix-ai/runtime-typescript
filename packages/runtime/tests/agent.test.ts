/**
 * Tests for the callback-based Agent class and factory functions.
 */

import { describe, it, expect } from 'vitest';
import {
  Agent,
  agent,
  chatAgent,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
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

  it('should have default metadata with type', () => {
    const agent = new Agent('my-agent');
    expect(agent.metadata).toEqual({ type: 'agent' });
  });
});

describe('Agent Handler Registration', () => {
  it('should register invoke handler with onInvoke', async () => {
    const agent = new Agent('test-agent');

    agent.onInvoke(async (request) => {
      return { output: 'test' };
    });

    // Handler should be registered (we can test this by calling invoke)
    await expect(agent.invoke({ input: { task: 'test' } })).resolves.toEqual({
      output: 'test',
    });
  });

  it('should register chat handler with onChat', async () => {
    const agent = new Agent('test-agent');

    agent.onChat(async (request) => {
      return { output: 'test', messages: [] };
    });

    await expect(agent.chat({ messages: [{ role: 'user', content: 'hi' }] })).resolves.toEqual({
      output: 'test',
      messages: [],
    });
  });

  it('should return this for method chaining', () => {
    const agent = new Agent('test-agent');

    const result = agent
      .onInvoke(async () => ({ output: 'invoke' }))
      .onChat(async () => ({ output: 'chat', messages: [] }));

    expect(result).toBe(agent);
  });
});

describe('Agent Streaming Flags', () => {
  it('should have invokeStreaming false by default', () => {
    const agent = new Agent('test-agent');
    expect(agent.invokeStreaming).toBe(false);
  });

  it('should have chatStreaming false by default', () => {
    const agent = new Agent('test-agent');
    expect(agent.chatStreaming).toBe(false);
  });

  it('should have invokeStreaming true when handler registered', () => {
    const agent = new Agent('test-agent');

    agent.onInvokeStream(async function* () {
      yield '{"chunk": "test"}';
    });

    expect(agent.invokeStreaming).toBe(true);
  });

  it('should have chatStreaming true when handler registered', () => {
    const agent = new Agent('test-agent');

    agent.onChatStream(async function* () {
      yield '{"chunk": "test"}';
    });

    expect(agent.chatStreaming).toBe(true);
  });
});

describe('Agent Invoke', () => {
  it('should call registered invoke handler', async () => {
    const agent = new Agent('test-agent');

    agent.onInvoke(async (request) => {
      const task = (request.input as Record<string, string>).task || 'unknown';
      return { output: `Completed: ${task}` };
    });

    const response = await agent.invoke({ input: { task: 'summarize' } });
    expect(response.output).toBe('Completed: summarize');
  });

  it('should throw when no invoke handler registered', async () => {
    const agent = new Agent('test-agent');

    await expect(agent.invoke({ input: { task: 'test' } })).rejects.toThrow(
      "No invoke handler registered for agent 'test-agent'"
    );
  });
});

describe('Agent Chat', () => {
  it('should call registered chat handler', async () => {
    const agent = new Agent('test-agent');

    agent.onChat(async (request) => {
      const userMsg = request.messages[request.messages.length - 1].content;
      return {
        output: `Hello: ${userMsg}`,
        messages: [{ role: 'assistant', content: `Hello: ${userMsg}` }],
      };
    });

    const response = await agent.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(response.output).toBe('Hello: hi');
    expect(response.messages).toHaveLength(1);
  });

  it('should throw when no chat handler registered', async () => {
    const agent = new Agent('test-agent');

    await expect(agent.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      "No chat handler registered for agent 'test-agent'"
    );
  });
});

describe('Agent Invoke Stream', () => {
  it('should call registered invoke stream handler', async () => {
    const agent = new Agent('test-agent');

    agent.onInvokeStream(async function* (request) {
      yield '{"chunk": "Hello"}';
      yield '{"chunk": " world"}';
    });

    const chunks: string[] = [];
    for await (const chunk of agent.invokeStream({ input: { task: 'test' } })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['{"chunk": "Hello"}', '{"chunk": " world"}']);
  });

  it('should throw when no invoke stream handler registered', async () => {
    const agent = new Agent('test-agent');
    const generator = agent.invokeStream({ input: { task: 'test' } });

    await expect(generator.next()).rejects.toThrow(
      "No streaming invoke handler registered for agent 'test-agent'"
    );
  });
});

describe('Agent Chat Stream', () => {
  it('should call registered chat stream handler', async () => {
    const agent = new Agent('test-agent');

    agent.onChatStream(async function* (request) {
      yield '{"chunk": "Hi"}';
      yield '{"chunk": " there"}';
    });

    const chunks: string[] = [];
    for await (const chunk of agent.chatStream({
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['{"chunk": "Hi"}', '{"chunk": " there"}']);
  });

  it('should throw when no chat stream handler registered', async () => {
    const agent = new Agent('test-agent');
    const generator = agent.chatStream({
      messages: [{ role: 'user', content: 'hi' }],
    });

    await expect(generator.next()).rejects.toThrow(
      "No streaming chat handler registered for agent 'test-agent'"
    );
  });
});

describe('Agent With Context', () => {
  it('should pass context to invoke handler', async () => {
    const agent = new Agent('test-agent');
    let receivedContext: Record<string, unknown> | undefined;

    agent.onInvoke(async (request) => {
      receivedContext = request.context;
      return { output: 'done' };
    });

    await agent.invoke({
      input: { task: 'test' },
      context: { user_id: '123', session: 'abc' },
    });

    expect(receivedContext).toEqual({ user_id: '123', session: 'abc' });
  });

  it('should pass context to chat handler', async () => {
    const agent = new Agent('test-agent');
    let receivedContext: Record<string, unknown> | undefined;

    agent.onChat(async (request) => {
      receivedContext = request.context;
      return { output: 'done', messages: [] };
    });

    await agent.chat({
      messages: [{ role: 'user', content: 'hi' }],
      context: { user_id: '456' },
    });

    expect(receivedContext).toEqual({ user_id: '456' });
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

  it('should handle /agents/{name}/invoke endpoint', async () => {
    const testAgent = new Agent('test-agent');
    testAgent.onInvoke(async (req) => ({
      output: `Received: ${(req.input as Record<string, string>).message}`,
    }));
    const handler = testAgent.toHandler();

    const request = new Request('http://localhost/agents/test-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { message: 'hello' } }),
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toBe('Received: hello');
  });

  it('should handle /agents/{name}/chat endpoint', async () => {
    const testAgent = new Agent('test-agent');
    testAgent.onChat(async (req) => ({
      output: `Reply to: ${req.messages[0].content}`,
      messages: [...req.messages, { role: 'assistant', content: 'hi!' }],
    }));
    const handler = testAgent.toHandler();

    const request = new Request('http://localhost/agents/test-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toBe('Reply to: hello');
    expect(body.messages).toHaveLength(2);
  });

  it('should return 404 for wrong agent name', async () => {
    const testAgent = new Agent('test-agent');
    testAgent.onInvoke(async () => ({ output: 'ok' }));
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
      execute: async ({ a, b }) => (a as number) + (b as number),
    });

    expect(calculator).toBeInstanceOf(Agent);
    expect(calculator.name).toBe('calculator');
  });

  it('should set description in metadata', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      execute: async () => 0,
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
      execute: async () => 0,
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

  it('should set output in metadata when provided', () => {
    const calculator = agent('calculator', {
      description: 'Add two numbers',
      parameters: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
      output: { type: 'number' },
      execute: async () => 0,
    });

    expect(calculator.metadata.output).toEqual({ type: 'number' });
  });

  it('should not include output in metadata when not provided', () => {
    const calculator = agent('calculator', {
      execute: async () => 0,
    });

    expect(calculator.metadata.output).toBeUndefined();
  });

  it('should handle invoke requests', async () => {
    const calculator = agent('calculator', {
      execute: async ({ a, b }) => (a as number) + (b as number),
    });

    const response = await calculator.invoke({ input: { a: 3, b: 4 } });
    expect(response.output).toBe(7);
  });

  it('should pass context to execute handler', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const myAgent = agent('my-agent', {
      execute: async (input, context) => {
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
      execute: async function* ({ text }) {
        for (const word of (text as string).split(' ')) {
          yield word + ' ';
        }
      },
    });

    // Should have streaming enabled
    expect(streamer.invokeStreaming).toBe(true);

    // Test streaming
    const chunks: string[] = [];
    for await (const chunk of streamer.invokeStream({ input: { text: 'hello world' } })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['hello ', 'world ']);
  });

  it('should collect chunks for non-streaming requests', async () => {
    const streamer = agent('streamer', {
      execute: async function* ({ text }) {
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
      execute: async () => 'Hello!',
    });

    expect(bot).toBeInstanceOf(Agent);
    expect(bot.name).toBe('bot');
  });

  it('should set description in metadata', () => {
    const bot = chatAgent('bot', {
      description: 'A helpful assistant',
      execute: async () => 'Hello!',
    });

    expect(bot.metadata.description).toBe('A helpful assistant');
  });

  it('should set standard parameters schema in metadata', () => {
    const bot = chatAgent('bot', {
      execute: async () => 'Hello!',
    });

    const params = bot.metadata.parameters as Record<string, unknown>;
    expect(params.type).toBe('object');
    expect(params.properties).toHaveProperty('messages');
    expect(params.required).toContain('messages');
  });

  it('should set standard output schema in metadata', () => {
    const bot = chatAgent('bot', {
      execute: async () => 'Hello!',
    });

    expect(bot.metadata.output).toEqual({ type: 'string' });
  });

  it('should handle chat requests', async () => {
    const echoBot = chatAgent('echo-bot', {
      execute: async (messages) => {
        const lastMsg = messages.at(-1)?.content ?? '';
        return `You said: ${lastMsg}`;
      },
    });

    const response = await echoBot.chat({
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(response.output).toBe('You said: hello');
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].role).toBe('assistant');
    expect(response.messages[1].content).toBe('You said: hello');
  });

  it('should pass context to execute handler', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const bot = chatAgent('bot', {
      execute: async (messages, context) => {
        receivedContext = context;
        return 'done';
      },
    });

    await bot.chat({
      messages: [{ role: 'user', content: 'hi' }],
      context: { user_id: '456' },
    });

    expect(receivedContext).toEqual({ user_id: '456' });
  });

  it('should handle streaming with async generator', async () => {
    const streamingBot = chatAgent('streaming-bot', {
      execute: async function* () {
        yield 'Hello';
        yield ' ';
        yield 'world!';
      },
    });

    // Should have streaming enabled
    expect(streamingBot.chatStreaming).toBe(true);

    // Test streaming
    const chunks: string[] = [];
    for await (const chunk of streamingBot.chatStream({
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' ', 'world!']);
  });

  it('should collect chunks for non-streaming requests', async () => {
    const streamingBot = chatAgent('streaming-bot', {
      execute: async function* () {
        yield 'Hello';
        yield ' ';
        yield 'world!';
      },
    });

    const response = await streamingBot.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response.output).toBe('Hello world!');
    expect(response.messages[1].content).toBe('Hello world!');
  });
});
