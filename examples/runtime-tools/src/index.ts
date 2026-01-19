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
 *     # Discovery (shows available tools)
 *     curl http://localhost:8080/info
 *
 *     # Execute the weather tool
 *     curl -X POST http://localhost:8080/tools/get_weather/execute \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"location": "San Francisco"}}'
 *
 *     # Execute the calculator tool
 *     curl -X POST http://localhost:8080/tools/calculate/execute \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"a": 10, "b": 5, "operation": "add"}}'
 */

import { tool, serve } from '@reminix/runtime';

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
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name (e.g., "San Francisco", "New York")',
      },
      units: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        default: 'fahrenheit',
        description: 'Temperature units',
      },
    },
    required: ['location'],
  },
  // Optional: define the output schema for documentation
  output: {
    type: 'object',
    properties: {
      location: { type: 'string' },
      temperature: { type: 'number' },
      units: { type: 'string' },
      condition: { type: 'string' },
    },
  },
  execute: async (input) => {
    const location = (input.location as string).toLowerCase();
    const units = (input.units as string) || 'fahrenheit';

    const weather = weatherData[location];
    if (!weather) {
      return {
        error: `Weather data not available for "${input.location}"`,
        available_cities: Object.keys(weatherData),
      };
    }

    let temp = weather.temp;
    if (units === 'celsius') {
      temp = Math.round(((temp - 32) * 5) / 9);
    }

    return {
      location: input.location,
      temperature: temp,
      units,
      condition: weather.condition,
    };
  },
});

// Tool 2: Simple calculator
const calculate = tool('calculate', {
  description: 'Perform basic math operations',
  parameters: {
    type: 'object',
    properties: {
      a: { type: 'number', description: 'First operand' },
      b: { type: 'number', description: 'Second operand' },
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'Math operation to perform',
      },
    },
    required: ['a', 'b', 'operation'],
  },
  execute: async (input) => {
    const a = input.a as number;
    const b = input.b as number;
    const op = input.operation as string;

    let result: number;
    switch (op) {
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
        return { error: `Unknown operation: ${op}` };
    }

    return { a, b, operation: op, result };
  },
});

// Tool 3: String utilities
const stringUtils = tool('string_utils', {
  description: 'Perform string operations',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Input text' },
      operation: {
        type: 'string',
        enum: ['uppercase', 'lowercase', 'reverse', 'length'],
        description: 'String operation to perform',
      },
    },
    required: ['text', 'operation'],
  },
  execute: async (input) => {
    const text = input.text as string;
    const op = input.operation as string;

    switch (op) {
      case 'uppercase':
        return { result: text.toUpperCase() };
      case 'lowercase':
        return { result: text.toLowerCase() };
      case 'reverse':
        return { result: text.split('').reverse().join('') };
      case 'length':
        return { result: text.length };
      default:
        return { error: `Unknown operation: ${op}` };
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
console.log('  GET  /info');
console.log('  POST /tools/get_weather/execute');
console.log('  POST /tools/calculate/execute');
console.log('  POST /tools/string_utils/execute');
console.log();

serve({ tools: [getWeather, calculate, stringUtils], port: 8080 });
