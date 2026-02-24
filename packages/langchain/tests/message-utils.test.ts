/**
 * Tests for message conversion utilities.
 */

import { describe, it, expect } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

import type { Message } from '@reminix/runtime';
import { toLangChainMessage, fromLangChainMessage } from '../src/message-utils.js';

describe('toLangChainMessage', () => {
  it('should convert user message to HumanMessage', () => {
    const msg: Message = { role: 'user', content: 'Hello' };
    const result = toLangChainMessage(msg);
    expect(result).toBeInstanceOf(HumanMessage);
    expect(result.content).toBe('Hello');
  });

  it('should convert assistant message to AIMessage', () => {
    const msg: Message = { role: 'assistant', content: 'Hi there' };
    const result = toLangChainMessage(msg);
    expect(result).toBeInstanceOf(AIMessage);
    expect(result.content).toBe('Hi there');
  });

  it('should convert system message to SystemMessage', () => {
    const msg: Message = { role: 'system', content: 'You are helpful' };
    const result = toLangChainMessage(msg);
    expect(result).toBeInstanceOf(SystemMessage);
    expect(result.content).toBe('You are helpful');
  });

  it('should convert developer message to SystemMessage', () => {
    const msg: Message = { role: 'developer', content: 'Instructions' };
    const result = toLangChainMessage(msg);
    expect(result).toBeInstanceOf(SystemMessage);
  });

  it('should convert tool message to ToolMessage', () => {
    const msg: Message = { role: 'tool', content: 'Tool output', tool_call_id: 'call_1' };
    const result = toLangChainMessage(msg);
    expect(result).toBeInstanceOf(ToolMessage);
    expect(result.content).toBe('Tool output');
  });

  it('should include tool_calls on assistant messages', () => {
    const msg: Message = {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'get_weather', arguments: '{"city":"London"}' },
        },
      ],
    };
    const result = toLangChainMessage(msg);
    expect(result).toBeInstanceOf(AIMessage);
    const aiMsg = result as any;
    expect(aiMsg.tool_calls).toHaveLength(1);
    expect(aiMsg.tool_calls[0].name).toBe('get_weather');
    expect(aiMsg.tool_calls[0].args).toEqual({ city: 'London' });
  });
});

describe('fromLangChainMessage', () => {
  it('should convert HumanMessage to user message', () => {
    const msg = new HumanMessage({ content: 'Hello' });
    const result = fromLangChainMessage(msg);
    expect(result.role).toBe('user');
    expect(result.content).toBe('Hello');
  });

  it('should convert AIMessage to assistant message', () => {
    const msg = new AIMessage({ content: 'Hi' });
    const result = fromLangChainMessage(msg);
    expect(result.role).toBe('assistant');
    expect(result.content).toBe('Hi');
  });

  it('should convert SystemMessage to system message', () => {
    const msg = new SystemMessage({ content: 'System prompt' });
    const result = fromLangChainMessage(msg);
    expect(result.role).toBe('system');
    expect(result.content).toBe('System prompt');
  });

  it('should convert ToolMessage to tool message', () => {
    const msg = new ToolMessage({ content: 'Result', tool_call_id: 'call_1' });
    const result = fromLangChainMessage(msg);
    expect(result.role).toBe('tool');
    expect(result.content).toBe('Result');
    expect(result.tool_call_id).toBe('call_1');
  });

  it('should convert AIMessage with tool_calls', () => {
    const msg = new AIMessage({
      content: '',
      tool_calls: [{ id: 'call_1', name: 'search', args: { q: 'test' } }],
    });
    const result = fromLangChainMessage(msg);
    expect(result.role).toBe('assistant');
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls![0].function.name).toBe('search');
    expect(JSON.parse(result.tool_calls![0].function.arguments)).toEqual({ q: 'test' });
  });
});
