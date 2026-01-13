/**
 * Tests for the callback-based Agent class.
 */

import { describe, it, expect } from 'vitest';
import {
  Agent,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
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

    await expect(
      agent.chat({ messages: [{ role: 'user', content: 'hi' }] })
    ).resolves.toEqual({ output: 'test', messages: [] });
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

    await expect(
      agent.chat({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow("No chat handler registered for agent 'test-agent'");
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
