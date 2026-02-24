/**
 * Message conversion utilities between Reminix and Vercel AI SDK formats.
 */

import type { ModelMessage } from 'ai';

import { messageContentToText, type Message } from '@reminix/runtime';

/**
 * Convert Reminix messages to Vercel AI SDK ModelMessages.
 */
export function toModelMessages(messages: Message[]): ModelMessage[] {
  return messages.map((m) => {
    if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') {
      return { role: 'user' as const, content: messageContentToText(m.content) };
    }
    return {
      role: m.role,
      content: messageContentToText(m.content) || '',
    };
  });
}

/**
 * Convert Vercel AI SDK response messages to Reminix Message format.
 */
export function fromModelMessages(
  responseMessages: Array<{ role: string; content: unknown }>
): Message[] {
  const result: Message[] = [];

  for (const msg of responseMessages) {
    if (msg.role === 'assistant') {
      const textParts: string[] = [];
      const toolCalls: Message['tool_calls'] = [];

      if (typeof msg.content === 'string') {
        textParts.push(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            textParts.push(part.text);
          } else if (part.type === 'tool-call') {
            toolCalls.push({
              id: part.toolCallId,
              type: 'function',
              function: {
                name: part.toolName,
                arguments: JSON.stringify(part.input),
              },
            });
          }
        }
      }

      result.push({
        role: 'assistant',
        content: textParts.join(' ') || '',
        ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
      });
    } else if (msg.role === 'tool' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'tool-result') {
          const outputVal = part.output;
          let content: string;
          if (outputVal && typeof outputVal === 'object' && 'value' in outputVal) {
            content = JSON.stringify((outputVal as { value: unknown }).value);
          } else {
            content = JSON.stringify(outputVal);
          }
          result.push({
            role: 'tool',
            content,
            tool_call_id: part.toolCallId,
          });
        }
      }
    }
  }

  return result;
}
