/**
 * Shared setup for integration tests.
 */

import 'dotenv/config';

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

export function skipIfNoOpenAIKey(): void {
  if (!process.env.OPENAI_API_KEY) {
    console.log('Skipping: OPENAI_API_KEY not set');
    process.exit(0);
  }
}

export function skipIfNoAnthropicKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('Skipping: ANTHROPIC_API_KEY not set');
    process.exit(0);
  }
}
