/**
 * Helpers for message content (string | ContentPart[] | null).
 */

import type { AgentRequest, ContentPart, Message } from './types.js';

/**
 * Normalize message content to a single string for providers that only accept text.
 * - string: returned as-is
 * - ContentPart[]: text parts joined; other parts rendered as [type]
 * - null: empty string
 */
export function messageContentToText(content: string | ContentPart[] | null): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  return content
    .map((p) => {
      if ('text' in p && typeof p.text === 'string') return p.text;
      const type = 'type' in p ? String(p.type) : 'part';
      return `[${type}]`;
    })
    .join(' ');
}

/**
 * Extract a list of Messages from an AgentRequest's input.
 *
 * Handles three input shapes that all adapters accept:
 * - `{ messages: [...] }` — chat-style, returned as Message list
 * - `{ prompt: "..." }` — single prompt, wrapped as a user message
 * - anything else — stringified and wrapped as a user message
 */
export function buildMessagesFromInput(request: AgentRequest): Message[] {
  const input = request.input as Record<string, unknown>;
  if ('messages' in input) {
    return input.messages as Message[];
  } else if ('prompt' in input) {
    return [{ role: 'user', content: String(input.prompt) }];
  } else {
    return [{ role: 'user', content: JSON.stringify(input) }];
  }
}
