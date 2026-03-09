/**
 * Tests for content helpers.
 */

import { describe, it, expect } from 'vitest';
import { messageContentToText, buildMessagesFromInput } from '../src/content.js';
import type { AgentRequest, ContentPart } from '../src/types.js';

describe('messageContentToText', () => {
  it('should return string content as-is', () => {
    expect(messageContentToText('hello')).toBe('hello');
  });

  it('should return empty string for null', () => {
    expect(messageContentToText(null)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(messageContentToText('')).toBe('');
  });

  it('should join text content parts', () => {
    const parts: ContentPart[] = [
      { type: 'text', text: 'hello' },
      { type: 'text', text: 'world' },
    ];
    expect(messageContentToText(parts)).toBe('hello world');
  });

  it('should render non-text parts as [type]', () => {
    const parts: ContentPart[] = [
      { type: 'text', text: 'Look at this:' },
      { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
      { type: 'text', text: 'Nice, right?' },
    ];
    expect(messageContentToText(parts)).toBe('Look at this: [image_url] Nice, right?');
  });

  it('should handle refusal parts', () => {
    const parts: ContentPart[] = [{ type: 'refusal', refusal: "I can't do that" }];
    expect(messageContentToText(parts)).toBe('[refusal]');
  });
});

describe('buildMessagesFromInput', () => {
  it('should extract messages from input.messages', () => {
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'hi' }] },
    };
    const messages = buildMessagesFromInput(request);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('hi');
  });

  it('should handle multiple messages', () => {
    const request: AgentRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'hi' },
        ],
      },
    };
    const messages = buildMessagesFromInput(request);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('should wrap prompt as user message', () => {
    const request: AgentRequest = {
      input: { prompt: 'hello' },
    };
    const messages = buildMessagesFromInput(request);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('hello');
  });

  it('should stringify fallback input as JSON', () => {
    const request: AgentRequest = {
      input: { key: 'value', num: 42 },
    };
    const messages = buildMessagesFromInput(request);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('{"key":"value","num":42}');
  });

  it('should handle empty input', () => {
    const request: AgentRequest = {
      input: {},
    };
    const messages = buildMessagesFromInput(request);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('{}');
  });
});
