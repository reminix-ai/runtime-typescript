/**
 * Integration tests for OpenAI adapter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import OpenAI from 'openai';
import { wrap } from '@reminix/openai';
import { createApp } from '@reminix/runtime';
import type { Hono } from 'hono';
import { getOpenAIApiKey } from './setup.js';

describe('OpenAI Adapter Integration', () => {
  let app: Hono;

  beforeAll(() => {
    const apiKey = getOpenAIApiKey();
    const client = new OpenAI({ apiKey });
    const agent = wrap(client, { name: 'test-openai', model: 'gpt-4.1-nano' });
    app = createApp([agent]);
  });

  it('should invoke with a prompt', async () => {
    const response = await app.request('/agents/test-openai/invoke', {
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
    const response = await app.request('/agents/test-openai/invoke', {
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

  it('should handle chat conversation', async () => {
    const response = await app.request('/agents/test-openai/chat', {
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
    const response = await app.request('/agents/test-openai/invoke/stream', {
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
    const response = await app.request('/agents/test-openai/chat/stream', {
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
