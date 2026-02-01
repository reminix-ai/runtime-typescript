/**
 * Helpers for message content (string | ContentPart[] | null).
 */

import type { ContentPart } from './types.js';

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
