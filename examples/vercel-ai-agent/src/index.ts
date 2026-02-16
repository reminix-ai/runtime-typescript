/**
 * Vercel AI Agent with Tools example
 *
 * This example shows how to create a Vercel AI ToolLoopAgent with tool calling
 * and serve it via Reminix Runtime.
 *
 * Requirements:
 *     npm install @reminix/vercel-ai ai @ai-sdk/openai zod dotenv
 *
 * Environment:
 *     Create a .env file in the repository root with:
 *     OPENAI_API_KEY=your-api-key
 *
 * Usage:
 *     npx tsx src/index.ts
 *
 * Then test the endpoints:
 *
 *     # With a simple prompt
 *     curl -X POST http://localhost:8080/agents/vercel-ai-agent/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"prompt": "What is the weather in Paris?"}}'
 *
 *     # Response: {"output": "The weather in Paris is sunny with a temperature of 22°C."}
 *
 *     # With messages (chat-style)
 *     curl -X POST http://localhost:8080/agents/vercel-ai-agent/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]}}'
 *
 *     # Response: {"output": "The weather in Tokyo is rainy with a temperature of 18°C."}
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { VercelAIChatAgent } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

// Define a tool for the agent to use
const getWeather = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    const weatherData: Record<string, string> = {
      paris: 'Sunny, 22°C',
      london: 'Cloudy, 15°C',
      tokyo: 'Rainy, 18°C',
      'new york': 'Partly cloudy, 20°C',
    };
    return weatherData[city.toLowerCase()] ?? `Weather data not available for ${city}`;
  },
});

// Create a Vercel AI ToolLoopAgent
const toolAgent = new ToolLoopAgent({
  model: openai('gpt-4o-mini'),
  tools: { getWeather },
});

// Create and serve the agent
const reminixAgent = new VercelAIChatAgent(toolAgent, { name: 'vercel-ai-agent' });
serve({ agents: [reminixAgent] });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /manifest');
console.log('  POST /agents/vercel-ai-agent/invoke');
console.log('\nAvailable tools:');
console.log('  - getWeather(city): Get weather for Paris, London, Tokyo, or New York');
