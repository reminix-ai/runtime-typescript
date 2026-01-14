/**
 * Tests for request/response types.
 */

import { describe, it, expect } from 'vitest';
import type {
  Message,
  InvokeRequest,
  InvokeResponse,
  ChatRequest,
  ChatResponse,
  ToolCall,
} from '../src/types.js';

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
});

describe('ChatRequest', () => {
  it('should have messages property', () => {
    const req: ChatRequest = {
      messages: [{ role: 'user', content: 'hello' }],
    };
    expect(req.messages).toHaveLength(1);
  });

  it('should accept conversation history', () => {
    const req: ChatRequest = {
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
        { role: 'user', content: 'how are you?' },
      ],
    };
    expect(req.messages).toHaveLength(3);
  });

  it('should accept optional stream flag', () => {
    const req: ChatRequest = {
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    };
    expect(req.stream).toBe(true);
  });

  it('should accept optional context', () => {
    const req: ChatRequest = {
      messages: [{ role: 'user', content: 'hello' }],
      context: { user_id: '123' },
    };
    expect(req.context).toEqual({ user_id: '123' });
  });
});

describe('ChatResponse', () => {
  it('should have output and messages properties', () => {
    const resp: ChatResponse = {
      output: "I'm doing well!",
      messages: [
        { role: 'user', content: 'how are you?' },
        { role: 'assistant', content: "I'm doing well!" },
      ],
    };
    expect(resp.output).toBe("I'm doing well!");
    expect(resp.messages).toHaveLength(2);
  });

  it('should include tool call messages', () => {
    const resp: ChatResponse = {
      output: 'The weather is 72°F',
      messages: [
        { role: 'user', content: "What's the weather?" },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: '1', type: 'function', function: { name: 'get_weather', arguments: '{}' } },
          ],
        },
        { role: 'tool', content: '72°F', tool_call_id: '1' },
        { role: 'assistant', content: 'The weather is 72°F' },
      ],
    };
    expect(resp.messages).toHaveLength(4);
  });
});
