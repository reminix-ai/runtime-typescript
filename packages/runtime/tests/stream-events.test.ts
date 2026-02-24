/**
 * Tests for stream event types and normalizeStreamChunk.
 */

import { describe, it, expect } from 'vitest';
import { normalizeStreamChunk } from '../src/server.js';
import type {
  StreamEvent,
  TextDeltaEvent,
  ToolCallEvent,
  ToolResultEvent,
  MessageEvent,
  StepEvent,
} from '../src/stream-events.js';

describe('normalizeStreamChunk', () => {
  it('should wrap a raw string as a text_delta event', () => {
    const result = normalizeStreamChunk('hello');
    expect(result).toEqual({ type: 'text_delta', delta: 'hello' });
  });

  it('should wrap an empty string as a text_delta event', () => {
    const result = normalizeStreamChunk('');
    expect(result).toEqual({ type: 'text_delta', delta: '' });
  });

  it('should pass through a text_delta event unchanged', () => {
    const event: TextDeltaEvent = { type: 'text_delta', delta: 'world' };
    const result = normalizeStreamChunk(event);
    expect(result).toBe(event);
  });

  it('should pass through a tool_call event unchanged', () => {
    const event: ToolCallEvent = {
      type: 'tool_call',
      tool_call: {
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
      },
    };
    const result = normalizeStreamChunk(event);
    expect(result).toBe(event);
  });

  it('should pass through a tool_result event unchanged', () => {
    const event: ToolResultEvent = {
      type: 'tool_result',
      tool_call_id: 'call_1',
      output: 'Sunny, 22°C',
    };
    const result = normalizeStreamChunk(event);
    expect(result).toBe(event);
  });

  it('should pass through a message event unchanged', () => {
    const event: MessageEvent = {
      type: 'message',
      message: { role: 'assistant', content: 'Hello!' },
    };
    const result = normalizeStreamChunk(event);
    expect(result).toBe(event);
  });

  it('should pass through a step event unchanged', () => {
    const event: StepEvent = {
      type: 'step',
      name: 'fetch_data',
      status: 'completed',
      output: { records: 10 },
    };
    const result = normalizeStreamChunk(event);
    expect(result).toBe(event);
  });
});
