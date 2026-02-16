/**
 * Basic Anthropic example
 *
 * This example shows how to create a simple Anthropic Claude agent
 * and serve it via Reminix Runtime.
 *
 * Requirements:
 *     npm install @reminix/anthropic @anthropic-ai/sdk dotenv
 *
 * Environment:
 *     Create a .env file in the repository root with:
 *     ANTHROPIC_API_KEY=your-api-key
 *
 * Usage:
 *     npx tsx src/index.ts
 *
 * Then test the endpoints:
 *
 *     # With a simple prompt
 *     curl -X POST http://localhost:8080/agents/anthropic-basic/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"prompt": "What is the capital of France?"}}'
 *
 *     # Response: {"output": "The capital of France is Paris."}
 *
 *     # With messages (chat-style)
 *     curl -X POST http://localhost:8080/agents/anthropic-basic/invoke \
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

import Anthropic from '@anthropic-ai/sdk';
import { AnthropicChatAgent } from '@reminix/anthropic';
import { serve } from '@reminix/runtime';

// Create an Anthropic client
const client = new Anthropic();

// Create and serve the agent
const agent = new AnthropicChatAgent(client, {
  name: 'anthropic-basic',
  model: 'claude-sonnet-4-20250514',
});
serve({ agents: [agent] });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /manifest');
console.log('  POST /agents/anthropic-basic/invoke');
