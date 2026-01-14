/**
 * Integration tests for Vercel AI adapter with tool calling.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { wrap } from '@reminix/vercel-ai';
import { createApp } from '@reminix/runtime';
import type { Hono } from 'hono';
import { getOpenAIApiKey } from './setup.js';

describe('Vercel AI Adapter Integration', () => {
  let app: Hono;

  beforeAll(() => {
    const apiKey = getOpenAIApiKey();

    const getWeather = tool({
      description: 'Get the current weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => {
        const weatherData: Record<string, string> = {
          paris: 'Sunny, 22°C',
          london: 'Cloudy, 15°C',
          tokyo: 'Rainy, 18°C',
        };
        return weatherData[city.toLowerCase()] ?? `Unknown weather for ${city}`;
      },
    });

    const agent = new ToolLoopAgent({
      model: openai('gpt-4.1-nano', { apiKey }),
      tools: { getWeather },
    });

    const reminixAgent = wrap(agent, { name: 'test-vercel-ai' });
    app = createApp([reminixAgent]);
  });

  it('should invoke with a prompt', async () => {
    const response = await app.request('/agents/test-vercel-ai/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: "Say 'hello' and nothing else." },
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBeDefined();
  });

  it('should handle chat', async () => {
    const response = await app.request('/agents/test-vercel-ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: "Say 'hi' and nothing else." }],
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBeDefined();
    expect(data.messages).toBeDefined();
  });

  it('should call tools and return results', async () => {
    const response = await app.request('/agents/test-vercel-ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: "What's the weather in Paris?" }],
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBeDefined();
    // The agent should have called the tool and returned weather info
    const output = data.output.toLowerCase();
    expect(output).toMatch(/sunny|22|paris/);
  });
});
