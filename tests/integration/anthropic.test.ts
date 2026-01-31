/**
 * Integration tests for Anthropic adapter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { wrapAgent } from '@reminix/anthropic';
import { createApp } from '@reminix/runtime';
import type { Hono } from 'hono';
import { getAnthropicApiKey } from './setup.js';

describe('Anthropic Adapter Integration', () => {
  let app: Hono;

  beforeAll(() => {
    const apiKey = getAnthropicApiKey();
    const client = new Anthropic({ apiKey });
    const agent = wrapAgent(client, {
      name: 'test-anthropic',
      model: 'claude-3-haiku-20240307',
      maxTokens: 100,
    });
    app = createApp({ agents: [agent] });
  });

  it('should execute with a prompt', async () => {
    const response = await app.request('/agents/test-anthropic/invoke', {
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
    const response = await app.request('/agents/test-anthropic/invoke', {
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

  it('should execute with system message', async () => {
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
    const data = (await response.json()) as { output: string };
    expect(data.output).toBeDefined();
    expect(data.output.toLowerCase()).toContain('yes');
  });

  it('should handle chat-style execute', async () => {
    const response = await app.request('/agents/test-anthropic/invoke', {
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
    const response = await app.request('/agents/test-anthropic/invoke', {
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
