/**
 * Tests for AgentAdapter.
 */

import { describe, it, expect } from 'vitest';
import {
  AgentAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
} from '../src/index.js';

/**
 * Create a minimal concrete adapter for testing.
 */
class TestAdapter extends AgentAdapter {
  get name(): string {
    return 'test-agent';
  }

  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    const task = (request.input as Record<string, unknown>).task || 'unknown';
    return {
      output: `Completed: ${task}`,
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const userMsg = request.messages[request.messages.length - 1].content;
    return {
      output: `Hello from chat: ${userMsg}`,
      messages: [{ role: 'assistant', content: `Hello from chat: ${userMsg}` }],
    };
  }
}

describe('AgentAdapter Contract', () => {
  it('should be an abstract class', () => {
    // TypeScript enforces this at compile time
    // We can verify the class exists and is abstract
    expect(AgentAdapter).toBeDefined();
  });

  it('should allow concrete implementations', () => {
    const adapter = new TestAdapter();
    expect(adapter).toBeInstanceOf(AgentAdapter);
  });
});

describe('Concrete Adapter', () => {
  it('should have a name property', () => {
    const adapter = new TestAdapter();
    expect(adapter.name).toBe('test-agent');
  });

  it('should return InvokeResponse from invoke', async () => {
    const adapter = new TestAdapter();
    const request: InvokeRequest = {
      input: { task: 'summarize' },
    };

    const response = await adapter.invoke(request);

    expect(response.output).toBe('Completed: summarize');
  });

  it('should return ChatResponse from chat', async () => {
    const adapter = new TestAdapter();
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'hello' }],
    };

    const response = await adapter.chat(request);

    expect(response.output).toBe('Hello from chat: hello');
    expect(response.messages).toHaveLength(1);
  });

  it('should throw from invokeStream by default', async () => {
    const adapter = new TestAdapter();
    const request: InvokeRequest = {
      input: { task: 'test' },
    };

    const generator = adapter.invokeStream(request);

    await expect(generator.next()).rejects.toThrow('Streaming not implemented for this adapter');
  });

  it('should throw from chatStream by default', async () => {
    const adapter = new TestAdapter();
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'hello' }],
    };

    const generator = adapter.chatStream(request);

    await expect(generator.next()).rejects.toThrow('Streaming not implemented for this adapter');
  });
});
