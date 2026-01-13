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
});

describe('InvokeRequest', () => {
  it('should have messages property', () => {
    const req: InvokeRequest = {
      messages: [{ role: 'user', content: 'hello' }],
    };
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
  });

  it('should accept multiple messages', () => {
    const req: InvokeRequest = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'hello' },
      ],
    };
    expect(req.messages).toHaveLength(2);
  });

  it('should accept optional context', () => {
    const req: InvokeRequest = {
      messages: [{ role: 'user', content: 'hello' }],
      context: { user_id: '123' },
    };
    
    expect(req.context).toEqual({ user_id: '123' });
  });
});

describe('InvokeResponse', () => {
  it('should have content and messages properties', () => {
    const resp: InvokeResponse = {
      content: 'Hello!',
      messages: [{ role: 'assistant', content: 'Hello!' }],
    };
    expect(resp.content).toBe('Hello!');
    expect(resp.messages).toHaveLength(1);
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
});

describe('ChatResponse', () => {
  it('should have content and messages properties', () => {
    const resp: ChatResponse = {
      content: "I'm doing well!",
      messages: [
        { role: 'user', content: 'how are you?' },
        { role: 'assistant', content: "I'm doing well!" },
      ],
    };
    expect(resp.content).toBe("I'm doing well!");
    expect(resp.messages).toHaveLength(2);
  });
});
