/**
 * Tests for AgentAdapter.
 */

import { describe, it, expect } from 'vitest';
import { AgentAdapter, type InvokeRequest, type InvokeResponse } from '../src/index.js';

/**
 * Create a minimal concrete adapter for testing.
 */
class TestAdapter extends AgentAdapter {
  get name(): string {
    return 'test-agent';
  }

  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    // Check if it's a chat-style request (has messages)
    const messages = (request.input as { messages?: { content: string }[] }).messages;
    if (messages) {
      const userMsg = messages[messages.length - 1].content;
      return { output: `Hello from chat: ${userMsg}` };
    }
    // Otherwise, it's a task-style request
    const task = (request.input as Record<string, unknown>).task || 'unknown';
    return { output: `Completed: ${task}` };
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

  it('should return InvokeResponse from invoke with messages input', async () => {
    const adapter = new TestAdapter();
    const request: InvokeRequest = {
      input: { messages: [{ role: 'user', content: 'hello' }] },
    };

    const response = await adapter.invoke(request);

    expect(response.output).toBe('Hello from chat: hello');
  });

  it('should throw from invokeStream by default', async () => {
    const adapter = new TestAdapter();
    const request: InvokeRequest = {
      input: { task: 'test' },
    };

    const generator = adapter.invokeStream(request);

    await expect(generator.next()).rejects.toThrow('Streaming not implemented for this adapter');
  });
});

describe('Adapter Metadata', () => {
  it('should have capabilities with streaming: true', () => {
    const adapter = new TestAdapter();
    expect(adapter.metadata.capabilities.streaming).toBe(true);
  });

  it('should have input schema', () => {
    const adapter = new TestAdapter();
    expect(adapter.metadata.input).toBeDefined();
  });

  it('should have output schema', () => {
    const adapter = new TestAdapter();
    expect(adapter.metadata.output).toBeDefined();
  });
});
