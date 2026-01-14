/**
 * Integration tests for Anthropic adapter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { wrap } from '@reminix/anthropic';
import { createApp } from '@reminix/runtime';
import type { Hono } from 'hono';
import { getAnthropicApiKey } from './setup.js';

describe('Anthropic Adapter Integration', () => {
  let app: Hono;

  beforeAll(() => {
    const apiKey = getAnthropicApiKey();
    const client = new Anthropic({ apiKey });
    const agent = wrap(client, {
      name: 'test-anthropic',
      model: 'claude-3-haiku-20240307',
      maxTokens: 100,
    });
    app = createApp([agent]);
  });

  it('should invoke with a prompt', async () => {
    const response = await app.request('/agents/test-anthropic/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: "Say 'hello' and nothing else." },
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBeDefined();
    expect(data.output.toLowerCase()).toContain('hello');
  });

  it('should invoke with messages array', async () => {
    const response = await app.request('/agents/test-anthropic/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          messages: [{ role: 'user', content: "Say 'test' and nothing else." }],
        },
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBeDefined();
    expect(data.output.length).toBeGreaterThan(0);
  });

  it('should invoke with system message', async () => {
    const response = await app.request('/agents/test-anthropic/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          messages: [
            { role: 'system', content: "You only respond with 'yes'." },
            { role: 'user', content: 'Do you understand?' },
          ],
        },
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBeDefined();
    expect(data.output.toLowerCase()).toContain('yes');
  });

  it('should handle chat conversation', async () => {
    const response = await app.request('/agents/test-anthropic/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: "Say 'hi' and nothing else." }],
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBeDefined();
    expect(data.messages).toHaveLength(2);
    expect(data.messages[1].role).toBe('assistant');
  });

  it.fails('should stream invoke (not implemented yet)', async () => {
    const response = await app.request('/agents/test-anthropic/invoke/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: "Say 'stream' and nothing else." },
      }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('data: ');
  });

  it.fails('should stream chat (not implemented yet)', async () => {
    const response = await app.request('/agents/test-anthropic/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: "Say 'ok' and nothing else." }],
      }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('data: ');
  });
});
