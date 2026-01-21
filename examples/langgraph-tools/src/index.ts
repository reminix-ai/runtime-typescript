/**
 * LangGraph with Tools example
 *
 * This example shows how to create a LangGraph ReAct agent with tool calling
 * and serve it via Reminix Runtime.
 *
 * Requirements:
 *     npm install @reminix/langgraph @langchain/openai @langchain/langgraph dotenv
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
 *     # Execute the agent
 *     curl -X POST http://localhost:8080/agents/langgraph-tools/execute \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"messages": [{"role": "user", "content": "What is the weather in Paris?"}]}}'
 *
 *     # Response: {"output": "The weather in Paris is sunny with a temperature of 22°C."}
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { wrapAgent } from '@reminix/langgraph';
import { serve } from '@reminix/runtime';

// Define a tool for the agent to use
const getWeather = tool(
  async ({ city }: { city: string }) => {
    const weatherData: Record<string, string> = {
      paris: 'Sunny, 22°C',
      london: 'Cloudy, 15°C',
      tokyo: 'Rainy, 18°C',
      'new york': 'Partly cloudy, 20°C',
    };
    return weatherData[city.toLowerCase()] ?? `Weather data not available for ${city}`;
  },
  {
    name: 'get_weather',
    description: 'Get the current weather for a city',
    schema: z.object({ city: z.string() }),
  }
);

// Create a LangGraph ReAct agent with tools
const llm = new ChatOpenAI({ model: 'gpt-4o-mini' });
const graph = createReactAgent({ llm, tools: [getWeather] });

// Wrap the graph with the Reminix adapter
const agent = wrapAgent(graph, 'langgraph-tools');

// Serve the agent
serve({ agents: [agent], port: 8080 });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /info');
console.log('  POST /agents/langgraph-tools/execute');
console.log('\nAvailable tools:');
console.log('  - get_weather(city): Get weather for Paris, London, Tokyo, or New York');
