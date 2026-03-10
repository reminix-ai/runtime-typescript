/**
 * Runtime Tools Example
 *
 * This example shows how to create and serve standalone tools using
 * the tool() factory function from @reminix/runtime.
 *
 * Usage:
 *     npx tsx src/index.ts
 *
 * Then test the endpoints:
 *
 *     # Health check
 *     curl http://localhost:8080/health
 *
 *     # Discovery
 *     curl http://localhost:8080/manifest
 *
 *     # List tools via MCP
 *     curl -X POST http://localhost:8080/mcp \
 *       -H "Content-Type: application/json" \
 *       -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
 *
 *     # Call a tool via MCP
 *     curl -X POST http://localhost:8080/mcp \
 *       -H "Content-Type: application/json" \
 *       -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_weather", "arguments": {"location": "San Francisco"}}, "id": 2}'
 */

import { tool, serve } from '@reminix/runtime';
import { z } from 'zod';

// Weather data (simulated)
const weatherData: Record<string, { temp: number; condition: string }> = {
  'san francisco': { temp: 65, condition: 'foggy' },
  'new york': { temp: 45, condition: 'cloudy' },
  'los angeles': { temp: 75, condition: 'sunny' },
  seattle: { temp: 50, condition: 'rainy' },
  miami: { temp: 85, condition: 'humid' },
};

// Tool 1: Get weather for a location (with output schema)
const getWeather = tool('get_weather', {
  description: 'Get the current weather for a city',
  inputSchema: z.object({
    location: z.string().describe('City name (e.g., "San Francisco", "New York")'),
    units: z.enum(['celsius', 'fahrenheit']).default('fahrenheit').describe('Temperature units'),
  }),
  // Optional: define the output schema for documentation
  outputSchema: z.object({
    location: z.string(),
    temperature: z.number(),
    units: z.string(),
    condition: z.string(),
  }),
  handler: async (args) => {
    const location = args.location.toLowerCase();
    const units = args.units;

    const weather = weatherData[location];
    if (!weather) {
      throw new Error(
        `Weather data not available for "${args.location}". Available: ${Object.keys(weatherData).join(', ')}`
      );
    }

    let temp = weather.temp;
    if (units === 'celsius') {
      temp = Math.round(((temp - 32) * 5) / 9);
    }

    return {
      location: args.location,
      temperature: temp,
      units,
      condition: weather.condition,
    };
  },
});

// Tool 2: Simple calculator
const calculate = tool('calculate', {
  description: 'Perform basic math operations',
  inputSchema: z.object({
    a: z.number().describe('First operand'),
    b: z.number().describe('Second operand'),
    operation: z
      .enum(['add', 'subtract', 'multiply', 'divide'])
      .describe('Math operation to perform'),
  }),
  handler: async (args) => {
    const { a, b, operation } = args;

    let result: number;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          return { error: 'Cannot divide by zero' };
        }
        result = a / b;
        break;
      default:
        return { error: `Unknown operation: ${operation}` };
    }

    return { a, b, operation, result };
  },
});

// Tool 3: String utilities
const stringUtils = tool('string_utils', {
  description: 'Perform string operations',
  inputSchema: z.object({
    text: z.string().describe('Input text'),
    operation: z
      .enum(['uppercase', 'lowercase', 'reverse', 'length'])
      .describe('String operation to perform'),
  }),
  handler: async (args) => {
    const { text, operation } = args;

    switch (operation) {
      case 'uppercase':
        return { result: text.toUpperCase() };
      case 'lowercase':
        return { result: text.toLowerCase() };
      case 'reverse':
        return { result: text.split('').reverse().join('') };
      case 'length':
        return { result: text.length };
      default:
        return { error: `Unknown operation: ${operation}` };
    }
  },
});

// Start the server with tools
console.log('Runtime Tools Example');
console.log('='.repeat(40));
console.log('Tools:');
console.log('  - get_weather: Get weather for a city');
console.log('  - calculate: Basic math operations');
console.log('  - string_utils: String manipulation');
console.log();
console.log('Server running on http://localhost:8080');
console.log();
console.log('Endpoints:');
console.log('  GET  /health');
console.log('  GET  /manifest');
console.log('  POST /mcp (MCP Streamable HTTP - tool discovery and execution)');
console.log();

serve({ tools: [getWeather, calculate, stringUtils] });
