/**
 * Shared setup for integration tests.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from the root of the monorepo
config({ path: resolve(__dirname, '../../.env') });

export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY not set');
  }
  return key;
}

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }
  return key;
}
