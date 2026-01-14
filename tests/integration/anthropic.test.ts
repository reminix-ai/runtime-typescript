/**
 * Integration tests for Anthropic adapter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { wrap } from '@reminix/anthropic';
import type { InvokeRequest, ChatRequest } from '@reminix/runtime';
import { getAnthropicApiKey } from './setup.js';

describe('Anthropic Adapter Integration', () => {
  let client: Anthropic;
  let agent: ReturnType<typeof wrap>;

  beforeAll(() => {
    const apiKey = getAnthropicApiKey();
    client = new Anthropic({ apiKey });
    agent = wrap(client, {
      name: 'test-anthropic',
      model: 'claude-3-haiku-20240307',
      maxTokens: 100,
    });
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

  it('should invoke with system message', async () => {
    const request: InvokeRequest = {
      input: {
        messages: [
          { role: 'system', content: "You only respond with 'yes'." },
          { role: 'user', content: 'Do you understand?' },
        ],
      },
    };
    const response = await agent.invoke(request);

    expect(response.output).toBeDefined();
    expect(response.output.toLowerCase()).toContain('yes');
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
