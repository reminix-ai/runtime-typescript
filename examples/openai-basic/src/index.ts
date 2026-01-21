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
 *     Create a .env file in the repository root with:
 *     OPENAI_API_KEY=your-api-key
 *
 * Usage:
 *     npx tsx src/index.ts
 *
 * Then test the endpoints:
 *
 *     # With a simple prompt
 *     curl -X POST http://localhost:8080/agents/openai-basic/execute \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"prompt": "What is the capital of France?"}}'
 *
 *     # Response: {"output": "The capital of France is Paris."}
 *
 *     # With messages (chat-style)
 *     curl -X POST http://localhost:8080/agents/openai-basic/execute \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"messages": [{"role": "user", "content": "Hello!"}]}}'
 *
 *     # Response: {"output": "Hello! How can I help you today?"}
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import OpenAI from 'openai';
import { wrapAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

// Create an OpenAI client
const client = new OpenAI();

// Wrap the client with the Reminix adapter
const agent = wrapAgent(client, { name: 'openai-basic', model: 'gpt-4o-mini' });

// Serve the agent
serve({ agents: [agent], port: 8080 });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /info');
console.log('  POST /agents/openai-basic/execute');
