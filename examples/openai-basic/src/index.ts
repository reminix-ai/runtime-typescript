/**
 * Basic OpenAI example
 *
 * This example shows how to create a simple OpenAI chat agent
 * and serve it via Reminix Runtime.
 *
 * Requirements:
 *     npm install @reminix/openai openai dotenv
 *
 * Environment:
 *     Create a .env file with:
 *     OPENAI_API_KEY=your-api-key
 *
 * Usage:
 *     npx tsx src/index.ts
 *
 * Then test the endpoints:
 *
 *     # Invoke endpoint (task-oriented)
 *     curl -X POST http://localhost:8080/agents/openai-basic/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"prompt": "What is the capital of France?"}}'
 *
 *     # Response: {"output": "The capital of France is Paris."}
 *
 *     # Chat endpoint (conversational)
 *     curl -X POST http://localhost:8080/agents/openai-basic/chat \
 *       -H "Content-Type: application/json" \
 *       -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
 *
 *     # Response: {"output": "Hello! How can I help you today?", "messages": [...]}
 */

import 'dotenv/config';

import OpenAI from 'openai';
import { wrap } from '@reminix/openai';
import { serve } from '@reminix/runtime';

// Create an OpenAI client
const client = new OpenAI();

// Wrap the client with the Reminix adapter
const agent = wrap(client, { name: 'openai-basic', model: 'gpt-4o-mini' });

// Serve the agent
serve([agent], { port: 8080 });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /info');
console.log('  POST /agents/openai-basic/invoke');
console.log('  POST /agents/openai-basic/chat');
