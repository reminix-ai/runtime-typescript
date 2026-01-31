/**
 * Tests for request/response types.
 */

import { describe, it, expect } from 'vitest';
import type { Message, InvokeRequest, InvokeResponse, ToolCall } from '../src/types.js';

describe('Message', () => {
  it('should have role and content properties', () => {
    const msg: Message = { role: 'user', content: 'hello' };
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('hello');
  });

  it('should accept valid roles', () => {
    const validRoles = ['user', 'assistant', 'system', 'tool'] as const;
    for (const role of validRoles) {
      const msg: Message = { role, content: 'test' };
      expect(msg.role).toBe(role);
    }
  });

  it('should allow null content for tool_calls', () => {
    const toolCall: ToolCall = {
      id: 'call_123',
      type: 'function',
      function: { name: 'get_weather', arguments: '{}' },
    };
    const msg: Message = { role: 'assistant', content: null, tool_calls: [toolCall] };
    expect(msg.content).toBeNull();
    expect(msg.tool_calls).toHaveLength(1);
  });

  it('should accept tool message fields', () => {
    const msg: Message = {
      role: 'tool',
      content: 'result',
      tool_call_id: 'call_123',
      name: 'get_weather',
    };
    expect(msg.tool_call_id).toBe('call_123');
    expect(msg.name).toBe('get_weather');
  });
});

describe('InvokeRequest', () => {
  it('should have input property', () => {
    const req: InvokeRequest = {
      input: { task: 'summarize', text: 'hello world' },
    };
    expect(req.input.task).toBe('summarize');
  });

  it('should accept optional stream flag', () => {
    const req: InvokeRequest = {
      input: { task: 'test' },
      stream: true,
    };
    expect(req.stream).toBe(true);
  });

  it('should accept optional context', () => {
    const req: InvokeRequest = {
      input: { task: 'test' },
      context: { user_id: '123' },
    };
    expect(req.context).toEqual({ user_id: '123' });
  });

  it('should accept messages in input for chat-style agents', () => {
    const req: InvokeRequest = {
      input: {
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi there' },
        ],
      },
    };
    expect((req.input as { messages: unknown[] }).messages).toHaveLength(2);
  });
});

describe('InvokeResponse', () => {
  it('should have output property', () => {
    const resp: InvokeResponse = {
      output: 'Result of the task',
    };
    expect(resp.output).toBe('Result of the task');
  });

  it('should accept any type of output', () => {
    const resp: InvokeResponse = {
      output: { result: 42, status: 'ok' },
    };
    expect(resp.output).toEqual({ result: 42, status: 'ok' });
  });

  it('should accept optional metadata', () => {
    const resp: InvokeResponse = {
      output: 'result',
      metadata: { model: 'gpt-4', latency_ms: 100 },
    };
    expect(resp.metadata).toEqual({ model: 'gpt-4', latency_ms: 100 });
  });
});
