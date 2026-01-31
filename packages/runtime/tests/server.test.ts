/**
 * Tests for the serve() function and server endpoints.
 */

import { describe, it, expect } from 'vitest';
import {
  AgentAdapter,
  VERSION,
  tool,
  type ExecuteRequest,
  type ExecuteResponse,
} from '../src/index.js';
import { createApp } from '../src/server.js';

/**
 * A mock adapter for testing task-style requests.
 */
class MockTaskAdapter extends AgentAdapter {
  static adapterName = 'mock';

  private _name: string;

  constructor(name: string = 'mock-agent') {
    super();
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  override get metadata() {
    return {
      ...super.metadata,
      requestKeys: ['task'],
      responseKeys: ['output'],
    };
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    const task = (request.input as Record<string, unknown>).task || 'unknown';
    return { output: `Completed task: ${task}` };
  }
}

/**
 * A mock adapter for testing chat-style requests.
 */
class MockChatAdapter extends AgentAdapter {
  static adapterName = 'mock';

  private _name: string;

  constructor(name: string = 'mock-agent') {
    super();
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  override get metadata() {
    return {
      ...super.metadata,
      requestKeys: ['messages'],
      responseKeys: ['messages'],
    };
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    const messages = (request.input as { messages?: { content: string }[] }).messages ?? [];
    const userMessage = messages[messages.length - 1]?.content ?? '';
    return { messages: [{ role: 'assistant', content: `Chat response to: ${userMessage}` }] };
  }
}

describe('createApp', () => {
  it('should return a Hono app', () => {
    const app = createApp({ agents: [new MockTaskAdapter()] });
    // Hono apps have a 'fetch' method
    expect(app).toHaveProperty('fetch');
  });

  it('should throw if no agents or tools provided', () => {
    expect(() => createApp({})).toThrow('At least one agent or tool is required');
  });
});

describe('Health Endpoint', () => {
  it('GET /health should return 200 OK', async () => {
    const app = createApp({ agents: [new MockTaskAdapter()] });
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('Info Endpoint', () => {
  it('GET /info should return runtime info and agents', async () => {
    const app = createApp({
      agents: [new MockTaskAdapter('agent-one'), new MockTaskAdapter('agent-two')],
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
    expect(data.agents[0].type).toBe('adapter');
    expect(data.agents[0].adapter).toBe('mock');
    expect(data.agents[0].streaming).toBe(true);
  });
});

describe('Execute Endpoint', () => {
  it('POST /agents/{agent}/invoke should return execute response', async () => {
    const app = createApp({ agents: [new MockTaskAdapter('my-agent')] });
    // Request body has top-level keys matching requestKeys: ['task']
    const response = await app.request('/agents/my-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'summarize' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBe('Completed task: summarize');
  });

  it('POST /agents/{agent}/invoke should accept context', async () => {
    const app = createApp({ agents: [new MockTaskAdapter('my-agent')] });
    const response = await app.request('/agents/my-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'test',
        context: { user_id: '123' },
      }),
    });

    expect(response.status).toBe(200);
  });

  it('POST /agents/{agent}/invoke should return 404 for unknown agent', async () => {
    const app = createApp({ agents: [new MockTaskAdapter('my-agent')] });
    const response = await app.request('/agents/unknown-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'test' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.toLowerCase()).toContain('not found');
  });

  it('POST /agents/{agent}/invoke should handle chat-style input', async () => {
    const app = createApp({ agents: [new MockChatAdapter('my-agent')] });
    // Request body has top-level keys matching requestKeys: ['messages']
    const response = await app.request('/agents/my-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi there' }] }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.messages[0]).toEqual({
      role: 'assistant',
      content: 'Chat response to: hi there',
    });
  });
});

describe('Tool Execute Endpoint', () => {
  it('POST /tools/{tool}/call should return tool response', async () => {
    const greetTool = tool('greet', {
      description: 'Greet someone',
      parameters: {
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
      parameters: { type: 'object', properties: {} },
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
      parameters: { type: 'object', properties: {} },
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
      parameters: { type: 'object', properties: {} },
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

    expect(response.status).toBe(500); // Tool errors return proper HTTP error codes
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
      parameters: {
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
    expect(data.tools[0].type).toBe('tool');
    expect(data.tools[0].description).toBe('My tool description');
    expect(data.tools[0].parameters).toBeDefined();
  });

  it('GET /info should include both agents and tools', async () => {
    const myTool = tool('my-tool', {
      description: 'Test tool',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    const app = createApp({
      agents: [new MockTaskAdapter('my-agent')],
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
