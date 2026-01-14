/**
 * Integration tests for LangGraph adapter with tool calling.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { wrap } from '@reminix/langgraph';
import { createApp } from '@reminix/runtime';
import type { Hono } from 'hono';
import { getOpenAIApiKey } from './setup.js';

const getWeather = tool(
  async ({ city }: { city: string }) => {
    const weatherData: Record<string, string> = {
      paris: 'Sunny, 22°C',
      london: 'Cloudy, 15°C',
      tokyo: 'Rainy, 18°C',
    };
    return weatherData[city.toLowerCase()] ?? `Unknown weather for ${city}`;
  },
  {
    name: 'get_weather',
    description: 'Get the current weather for a city',
    schema: z.object({ city: z.string() }),
  }
);

describe('LangGraph Adapter Integration', () => {
  let app: Hono;

  beforeAll(() => {
    const apiKey = getOpenAIApiKey();
    const llm = new ChatOpenAI({ model: 'gpt-4.1-nano', apiKey });
    const graph = createReactAgent({ llm, tools: [getWeather] });
    const agent = wrap(graph, 'test-langgraph');
    app = createApp([agent]);
  });

  it('should invoke', async () => {
    const response = await app.request('/agents/test-langgraph/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          messages: [{ role: 'user', content: "Say 'hello' and nothing else." }],
        },
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.output).toBeDefined();
  });

  it('should handle chat', async () => {
    const response = await app.request('/agents/test-langgraph/chat', {
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
    const response = await app.request('/agents/test-langgraph/chat', {
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
