/**
 * Message conversion utilities between Reminix and Google Gemini formats.
 */

import { messageContentToText, type Message } from '@reminix/runtime';

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * Convert Reminix messages to Gemini format, separating the system message.
 *
 * Returns the system instruction (if any) and the contents array.
 */
export function toGeminiContents(messages: Message[]): {
  system: string | undefined;
  contents: GeminiContent[];
} {
  let system: string | undefined;
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    const text = messageContentToText(message.content);
    if (message.role === 'system') {
      system = text;
    } else if (message.role === 'user') {
      contents.push({ role: 'user', parts: [{ text }] });
    } else if (message.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text }] });
    }
  }

  return { system, contents };
}
