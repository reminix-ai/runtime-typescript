/**
 * Tests for the serve() function and server endpoints.
 */

import { describe, it, expect } from 'vitest';
import { VERSION, tool, type AgentRequest, type AgentResponse } from '../src/index.js';
import { createApp } from '../src/server.js';

/**
 * A mock agent for testing task-style requests.
 */
class MockTaskAgent {
  private _name: string;

  constructor(name: string = 'mock-agent') {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get metadata() {
    return {
      capabilities: { streaming: true },
      framework: 'mock',
      input: { type: 'object' as const },
      output: { type: 'string' as const },
    };
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const task = (request.input as Record<string, unknown>).task || 'unknown';
    return { output: `Completed task: ${task}` };
  }

  async *invokeStream(_request: AgentRequest): AsyncGenerator<string> {
    yield '';
  }
}

/**
 * A mock agent for testing chat-style requests.
 */
class MockChatAgent {
  private _name: string;

  constructor(name: string = 'mock-agent') {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get metadata() {
    return {
      capabilities: { streaming: true },
      framework: 'mock',
      input: { type: 'object' as const },
      output: { type: 'string' as const },
    };
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    const messages = (request.input as { messages?: { content: string }[] }).messages ?? [];
    const userMessage = messages[messages.length - 1]?.content ?? '';
    return {
      output: { messages: [{ role: 'assistant', content: `Chat response to: ${userMessage}` }] },
    };
  }

  async *invokeStream(_request: AgentRequest): AsyncGenerator<string> {
    yield '';
  }
}

describe('createApp', () => {
  it('should return a Hono app', () => {
    const app = createApp({ agents: [new MockTaskAgent()] });
    // Hono apps have a 'fetch' method
    expect(app).toHaveProperty('fetch');
  });

  it('should throw if no agents or tools provided', () => {
    expect(() => createApp({})).toThrow('At least one agent or tool is required');
  });
});

describe('Health Endpoint', () => {
  it('GET /health should return 200 OK', async () => {
    const app = createApp({ agents: [new MockTaskAgent()] });
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('Info Endpoint', () => {
  it('GET /info should return runtime info and agents', async () => {
    const app = createApp({
      agents: [new MockTaskAgent('agent-one'), new MockTaskAgent('agent-two')],
    });
    const response = await app.request('/info');

    expect(response.status).toBe(200);
    const data = await response.json();

    // Check runtime info
    expect(data.runtime.name).toBe('reminix-runtime');
    expect(data.runtime.version).toBe(VERSION);
    expect(data.runtime.language).toBe('typescript');
    expect(data.runtime.framework).toBe('hono');

    // Check agents
    expect(data.agents).toHaveLength(2);
    expect(data.agents[0].name).toBe('agent-one');
    expect(data.agents[0].framework).toBe('mock');
    expect(data.agents[0].capabilities.streaming).toBe(true);
  });
});

describe('Invoke Endpoint', () => {
  it('POST /agents/{agent}/invoke should return invoke response', async () => {
    const app = createApp({ agents: [new MockTaskAgent('my-agent')] });
    // New API uses { input: { ... } }
    const response = await app.request('/agents/my-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { task: 'summarize' } }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBe('Completed task: summarize');
  });

  it('POST /agents/{agent}/invoke should accept context', async () => {
    const app = createApp({ agents: [new MockTaskAgent('my-agent')] });
    const response = await app.request('/agents/my-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { task: 'test' },
        context: { user_id: '123' },
      }),
    });

    expect(response.status).toBe(200);
  });

  it('POST /agents/{agent}/invoke should return 404 for unknown agent', async () => {
    const app = createApp({ agents: [new MockTaskAgent('my-agent')] });
    const response = await app.request('/agents/unknown-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { task: 'test' } }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.message.toLowerCase()).toContain('not found');
  });

  it('POST /agents/{agent}/invoke should handle chat-style input', async () => {
    const app = createApp({ agents: [new MockChatAgent('my-agent')] });
    const response = await app.request('/agents/my-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { messages: [{ role: 'user', content: 'hi there' }] } }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output.messages[0]).toEqual({
      role: 'assistant',
      content: 'Chat response to: hi there',
    });
  });
});

describe('Tool Call Endpoint', () => {
  it('POST /tools/{tool}/call should return tool response', async () => {
    const greetTool = tool('greet', {
      description: 'Greet someone',
      input: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      handler: async (input) => ({ message: `Hello, ${input.name}!` }),
    });

    const app = createApp({ tools: [greetTool] });
    const response = await app.request('/tools/greet/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { name: 'World' } }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toEqual({ message: 'Hello, World!' });
  });

  it('POST /tools/{tool}/call should accept context', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const myTool = tool('my-tool', {
      description: 'Test tool',
      input: { type: 'object', properties: {} },
      handler: async (input, context) => {
        receivedContext = context;
        return { done: true };
      },
    });

    const app = createApp({ tools: [myTool] });
    await app.request('/tools/my-tool/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {}, context: { user_id: '123' } }),
    });

    expect(receivedContext).toEqual({ user_id: '123' });
  });

  it('POST /tools/{tool}/call should return 404 for unknown tool', async () => {
    const myTool = tool('my-tool', {
      description: 'Test tool',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    const app = createApp({ tools: [myTool] });
    const response = await app.request('/tools/unknown-tool/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    });

    expect(response.status).toBe(404);
  });

  it('POST /tools/{tool}/call should return error on exception', async () => {
    const failingTool = tool('failing', {
      description: 'A tool that fails',
      input: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('Something went wrong');
      },
    });

    const app = createApp({ tools: [failingTool] });
    const response = await app.request('/tools/failing/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.message).toBe('Something went wrong');
    expect(data.error.type).toBe('Error');
  });
});

describe('Info Endpoint with Tools', () => {
  it('GET /info should include tools', async () => {
    const myTool = tool('my-tool', {
      description: 'My tool description',
      input: {
        type: 'object',
        properties: { param: { type: 'string' } },
        required: ['param'],
      },
      handler: async () => ({}),
    });

    const app = createApp({ tools: [myTool] });
    const response = await app.request('/info');

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.tools).toHaveLength(1);
    expect(data.tools[0].name).toBe('my-tool');
    expect(data.tools[0].description).toBe('My tool description');
    expect(data.tools[0].input).toBeDefined();
  });

  it('GET /info should include both agents and tools', async () => {
    const myTool = tool('my-tool', {
      description: 'Test tool',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    const app = createApp({
      agents: [new MockTaskAgent('my-agent')],
      tools: [myTool],
    });
    const response = await app.request('/info');

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].name).toBe('my-agent');

    expect(data.tools).toHaveLength(1);
    expect(data.tools[0].name).toBe('my-tool');
  });
});
