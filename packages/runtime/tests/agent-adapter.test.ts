/**
 * Tests for AgentAdapter.
 */

import { describe, it, expect } from 'vitest';
import { AgentAdapter, type ExecuteRequest, type ExecuteResponse } from '../src/index.js';

/**
 * Create a minimal concrete adapter for testing.
 */
class TestAdapter extends AgentAdapter {
  get name(): string {
    return 'test-agent';
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    // Check if it's a chat-style request (has messages)
    const messages = (request.input as { messages?: { content: string }[] }).messages;
    if (messages) {
      const userMsg = messages[messages.length - 1].content;
      return { output: `Hello from chat: ${userMsg}` };
    }
    // Otherwise, it's an invoke-style request
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

  it('should return ExecuteResponse from execute', async () => {
    const adapter = new TestAdapter();
    const request: ExecuteRequest = {
      input: { task: 'summarize' },
    };

    const response = await adapter.execute(request);

    expect(response.output).toBe('Completed: summarize');
  });

  it('should return ExecuteResponse from execute with messages input', async () => {
    const adapter = new TestAdapter();
    const request: ExecuteRequest = {
      input: { messages: [{ role: 'user', content: 'hello' }] },
    };

    const response = await adapter.execute(request);

    expect(response.output).toBe('Hello from chat: hello');
  });

  it('should throw from executeStream by default', async () => {
    const adapter = new TestAdapter();
    const request: ExecuteRequest = {
      input: { task: 'test' },
    };

    const generator = adapter.executeStream(request);

    await expect(generator.next()).rejects.toThrow('Streaming not implemented for this adapter');
  });
});
