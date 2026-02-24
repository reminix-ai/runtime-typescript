/**
 * Message conversion utilities between Reminix and Anthropic formats.
 */

import { messageContentToText, type Message } from '@reminix/runtime';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Convert Reminix messages to Anthropic format, separating the system message.
 *
 * Returns the system prompt (if any) and the user/assistant messages array.
 */
export function toAnthropicMessages(messages: Message[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  let system: string | undefined;
  const anthropicMessages: AnthropicMessage[] = [];

  for (const message of messages) {
    const text = messageContentToText(message.content);
    if (message.role === 'system') {
      system = text;
    } else if (message.role === 'user' || message.role === 'assistant') {
      anthropicMessages.push({ role: message.role, content: text });
    }
  }

  return { system, messages: anthropicMessages };
}
