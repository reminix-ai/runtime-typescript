/**
 * Integration tests for OpenAI adapter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import OpenAI from 'openai';
import { OpenAIChatAgent } from '@reminix/openai';
import { createApp } from '@reminix/runtime';
import type { Hono } from 'hono';
import { getOpenAIApiKey } from './setup.js';

describe('OpenAI Adapter Integration', () => {
  let app: Hono;

  beforeAll(() => {
    const apiKey = getOpenAIApiKey();
    const client = new OpenAI({ apiKey });
    const agent = new OpenAIChatAgent(client, { name: 'test-openai', model: 'gpt-4.1-nano' });
    app = createApp({ agents: [agent] });
  });

  it('should execute with a prompt', async () => {
    const response = await app.request('/agents/test-openai/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: "Say 'hello' and nothing else." },
      }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { output: string };
    expect(data.output).toBeDefined();
    expect(data.output.toLowerCase()).toContain('hello');
  });

  it('should execute with messages array', async () => {
    const response = await app.request('/agents/test-openai/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { messages: [{ role: 'user', content: "Say 'test' and nothing else." }] },
      }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { output: string };
    expect(data.output).toBeDefined();
    expect(data.output.length).toBeGreaterThan(0);
  });

  it('should handle chat-style execute', async () => {
    const response = await app.request('/agents/test-openai/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { messages: [{ role: 'user', content: "Say 'hi' and nothing else." }] },
      }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { output: string };
    expect(data.output).toBeDefined();
  });

  it('should stream execute', async () => {
    const response = await app.request('/agents/test-openai/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: "Say 'stream' and nothing else." },
        stream: true,
      }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('data: ');
  });
});
