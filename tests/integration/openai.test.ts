/**
 * Integration tests for OpenAI adapter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import OpenAI from 'openai';
import { wrap } from '@reminix/openai';
import type { InvokeRequest, ChatRequest } from '@reminix/runtime';
import { getOpenAIApiKey } from './setup.js';

describe('OpenAI Adapter Integration', () => {
  let client: OpenAI;
  let agent: ReturnType<typeof wrap>;

  beforeAll(() => {
    const apiKey = getOpenAIApiKey();
    client = new OpenAI({ apiKey });
    agent = wrap(client, { name: 'test-openai', model: 'gpt-4.1-nano' });
  });

  it('should invoke with a prompt', async () => {
    const request: InvokeRequest = {
      input: { prompt: "Say 'hello' and nothing else." },
    };
    const response = await agent.invoke(request);

    expect(response.output).toBeDefined();
    expect(response.output.length).toBeGreaterThan(0);
    expect(response.output.toLowerCase()).toContain('hello');
  });

  it('should invoke with messages array', async () => {
    const request: InvokeRequest = {
      input: {
        messages: [{ role: 'user', content: "Say 'test' and nothing else." }],
      },
    };
    const response = await agent.invoke(request);

    expect(response.output).toBeDefined();
    expect(response.output.length).toBeGreaterThan(0);
  });

  it('should handle chat conversation', async () => {
    const request: ChatRequest = {
      messages: [{ role: 'user', content: "Say 'hi' and nothing else." }],
    };
    const response = await agent.chat(request);

    expect(response.output).toBeDefined();
    expect(response.output.length).toBeGreaterThan(0);
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].role).toBe('assistant');
  });

  it('should stream invoke', async () => {
    const request: InvokeRequest = {
      input: { prompt: "Say 'stream' and nothing else." },
    };

    const chunks: string[] = [];
    for await (const chunk of agent.invokeStream(request)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should stream chat', async () => {
    const request: ChatRequest = {
      messages: [{ role: 'user', content: "Say 'ok' and nothing else." }],
    };

    const chunks: string[] = [];
    for await (const chunk of agent.chatStream(request)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });
});
