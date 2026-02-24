/**
 * Tests for the serve() function and server endpoints.
 */

import { describe, it, expect } from 'vitest';
import { Agent, VERSION, type AgentRequest, type AgentResponse } from '../src/index.js';
import { createApp } from '../src/server.js';

/**
 * A mock agent for testing task-style requests.
 */
class MockTaskAgent extends Agent {
  constructor(name: string = 'mock-agent') {
    super(name, {
      streaming: true,
      framework: 'mock',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'string' },
    });
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
class MockChatAgent extends Agent {
  constructor(name: string = 'mock-agent') {
    super(name, {
      streaming: true,
      framework: 'mock',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'string' },
    });
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

describe('Manifest Endpoint', () => {
  it('GET /manifest should return runtime info and agents', async () => {
    const app = createApp({
      agents: [new MockTaskAgent('agent-one'), new MockTaskAgent('agent-two')],
    });
    const response = await app.request('/manifest');

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

describe('Streaming SSE', () => {
  it('should stream typed events and end with [DONE]', async () => {
    const streamingAgent = new MockTaskAgent('stream-agent');
    // Override invokeStream to yield text chunks
    streamingAgent.invokeStream = async function* () {
      yield 'Hello ';
      yield 'world';
    };

    const app = createApp({ agents: [streamingAgent] });
    const response = await app.request('/agents/stream-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { task: 'test' }, stream: true }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();

    // Should contain typed text_delta events
    expect(text).toContain('"type":"text_delta"');
    expect(text).toContain('"delta":"Hello "');
    expect(text).toContain('"delta":"world"');
    // Should end with [DONE]
    expect(text).toContain('[DONE]');
  });

  it('should stream StreamEvent objects directly', async () => {
    const streamingAgent = new MockTaskAgent('event-agent');
    streamingAgent.invokeStream = async function* () {
      yield { type: 'message' as const, message: { role: 'assistant' as const, content: 'Hi' } };
    };

    const app = createApp({ agents: [streamingAgent] });
    const response = await app.request('/agents/event-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {}, stream: true }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"type":"message"');
    expect(text).toContain('"role":"assistant"');
  });

  it('should send errors as event: error', async () => {
    const streamingAgent = new MockTaskAgent('error-agent');
    streamingAgent.invokeStream = async function* () {
      yield 'partial';
      throw new Error('Stream failed');
    };

    const app = createApp({ agents: [streamingAgent] });
    const response = await app.request('/agents/error-agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {}, stream: true }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('event: error');
    expect(text).toContain('"type":"Error"');
    expect(text).toContain('Stream failed');
  });

  it('should return 501 for non-streaming agent', async () => {
    // Create a non-streaming agent (no invokeStream method)
    class NonStreamingAgent extends Agent {
      constructor() {
        super('no-stream', { streaming: false });
      }
      async invoke(): Promise<AgentResponse> {
        return { output: 'ok' };
      }
    }

    const app = createApp({ agents: [new NonStreamingAgent()] });
    const response = await app.request('/agents/no-stream/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {}, stream: true }),
    });

    expect(response.status).toBe(501);
  });
});
