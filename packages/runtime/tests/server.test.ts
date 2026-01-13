/**
 * Tests for the serve() function and server endpoints.
 */

import { describe, it, expect } from 'vitest';
import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
} from '../src/index.js';
import { createApp } from '../src/server.js';

/**
 * A mock adapter for testing.
 */
class MockAdapter extends BaseAdapter {
  private _name: string;

  constructor(name: string = 'mock-agent') {
    super();
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    const task = (request.input as Record<string, unknown>).task || 'unknown';
    return {
      output: `Completed task: ${task}`,
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const userMessage = request.messages[request.messages.length - 1].content;
    const responseContent = `Chat response to: ${userMessage}`;
    return {
      output: responseContent,
      messages: [
        ...request.messages,
        { role: 'assistant', content: responseContent },
      ],
    };
  }
}

describe('createApp', () => {
  it('should return a Hono app', () => {
    const app = createApp([new MockAdapter()]);
    // Hono apps have a 'fetch' method
    expect(app).toHaveProperty('fetch');
  });

  it('should throw if no agents provided', () => {
    expect(() => createApp([])).toThrow('At least one agent is required');
  });
});

describe('Health Endpoint', () => {
  it('GET /health should return 200 OK', async () => {
    const app = createApp([new MockAdapter()]);
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('Agents Endpoint', () => {
  it('GET /agents should return list of agent names', async () => {
    const app = createApp([new MockAdapter('agent-one'), new MockAdapter('agent-two')]);
    const response = await app.request('/agents');

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.agents).toEqual(['agent-one', 'agent-two']);
  });
});

describe('Invoke Endpoint', () => {
  it('POST /agents/{agent}/invoke should return invoke response', async () => {
    const app = createApp([new MockAdapter('my-agent')]);
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
    const app = createApp([new MockAdapter('my-agent')]);
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
    const app = createApp([new MockAdapter('my-agent')]);
    const response = await app.request('/agents/unknown-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { task: 'test' } }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.toLowerCase()).toContain('not found');
  });

  it('POST /agents/{agent}/invoke should return 400 for invalid request', async () => {
    const app = createApp([new MockAdapter('my-agent')]);
    const response = await app.request('/agents/my-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} }), // Empty input not allowed
    });

    expect(response.status).toBe(400);
  });
});

describe('Chat Endpoint', () => {
  it('POST /agents/{agent}/chat should return chat response', async () => {
    const app = createApp([new MockAdapter('my-agent')]);
    const response = await app.request('/agents/my-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi there' }] }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBe('Chat response to: hi there');
    expect(data.messages).toHaveLength(2); // user message + assistant response
  });

  it('POST /agents/{agent}/chat should return 404 for unknown agent', async () => {
    const app = createApp([new MockAdapter('my-agent')]);
    const response = await app.request('/agents/unknown-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    });

    expect(response.status).toBe(404);
  });
});
