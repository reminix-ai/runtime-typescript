/**
 * Message conversion utilities between Reminix and OpenAI formats.
 */

import type OpenAI from 'openai';

import { messageContentToText, type Message } from '@reminix/runtime';

/**
 * Convert a Reminix message to an OpenAI chat completion message.
 */
export function toOpenAIMessage(message: Message): OpenAI.Chat.ChatCompletionMessageParam {
  if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system')
    return { role: 'user', content: messageContentToText(message.content) };
  const result: OpenAI.Chat.ChatCompletionMessageParam = {
    role: message.role,
    content: messageContentToText(message.content) || '',
  };
  return result;
}
