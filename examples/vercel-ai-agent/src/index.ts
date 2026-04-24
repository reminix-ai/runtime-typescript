/**
 * Vercel AI SDK Agent — tool-calling agent served through Reminix.
 *
 * `VercelAIChatAgent` wraps a Vercel AI SDK `ToolLoopAgent` so it runs inside
 * the Reminix runtime. The agent below defines one `getWeather` tool and lets
 * the model call it as needed to answer weather questions — the tool loop is
 * handled by the SDK; Reminix takes care of serving it as an API.
 *
 * Invoke: POST /agents/vercel-ai-agent/invoke with { input: { prompt } }.
 */

import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { VercelAIChatAgent } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const getWeather = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => `The weather in ${city} is sunny, 22°C.`,
});

const toolAgent = new ToolLoopAgent({
  model: openai('gpt-4o-mini'),
  tools: { getWeather },
});

serve({ agents: [new VercelAIChatAgent(toolAgent, { name: 'vercel-ai-agent' })] });
