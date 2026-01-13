/**
 * Tests for BaseAdapter.
 */

import { describe, it, expect } from 'vitest';
import {
  BaseAdapter,
  type InvokeRequest,
  type InvokeResponse,
  type ChatRequest,
  type ChatResponse,
} from '../src/index.js';

/**
 * Create a minimal concrete adapter for testing.
 */
class TestAdapter extends BaseAdapter {
  get name(): string {
    return 'test-agent';
  }

  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    return {
      content: 'Hello from invoke!',
      messages: [{ role: 'assistant', content: 'Hello from invoke!' }],
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return {
      content: 'Hello from chat!',
      messages: [{ role: 'assistant', content: 'Hello from chat!' }],
    };
  }
}

describe('BaseAdapter Contract', () => {
  it('should be an abstract class', () => {
    // TypeScript enforces this at compile time
    // We can verify the class exists and is abstract
    expect(BaseAdapter).toBeDefined();
  });

  it('should allow concrete implementations', () => {
    const adapter = new TestAdapter();
    expect(adapter).toBeInstanceOf(BaseAdapter);
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
      messages: [{ role: 'user', content: 'hello' }],
    };

    const response = await adapter.invoke(request);

    expect(response.content).toBe('Hello from invoke!');
    expect(response.messages).toHaveLength(1);
  });

  it('should return ChatResponse from chat', async () => {
    const adapter = new TestAdapter();
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'hello' }],
    };

    const response = await adapter.chat(request);

    expect(response.content).toBe('Hello from chat!');
    expect(response.messages).toHaveLength(1);
  });

  it('should throw from invokeStream by default', async () => {
    const adapter = new TestAdapter();
    const request: InvokeRequest = {
      messages: [{ role: 'user', content: 'hello' }],
    };

    const generator = adapter.invokeStream(request);

    await expect(generator.next()).rejects.toThrow(
      'Streaming not implemented for this adapter'
    );
  });

  it('should throw from chatStream by default', async () => {
    const adapter = new TestAdapter();
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'hello' }],
    };

    const generator = adapter.chatStream(request);

    await expect(generator.next()).rejects.toThrow(
      'Streaming not implemented for this adapter'
    );
  });
});
