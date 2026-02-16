/**
 * Basic Google Gemini example
 *
 * This example shows how to create a simple Google Gemini agent
 * and serve it via Reminix Runtime.
 *
 * Requirements:
 *     npm install @reminix/google @google/genai dotenv
 *
 * Environment:
 *     Create a .env file in the repository root with:
 *     GOOGLE_API_KEY=your-api-key
 *
 * Usage:
 *     npx tsx src/index.ts
 *
 * Then test the endpoints:
 *
 *     # With a simple prompt
 *     curl -X POST http://localhost:8080/agents/google-basic/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"prompt": "What is the capital of France?"}}'
 *
 *     # Response: {"output": "The capital of France is Paris."}
 *
 *     # With messages (chat-style)
 *     curl -X POST http://localhost:8080/agents/google-basic/invoke \
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

import { GoogleGenAI } from '@google/genai';
import { GoogleChatAgent } from '@reminix/google';
import { serve } from '@reminix/runtime';

// Create a Google GenAI client
const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Create and serve the agent
const agent = new GoogleChatAgent(client, {
  name: 'google-basic',
  model: 'gemini-2.5-flash',
});
serve({ agents: [agent] });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /manifest');
console.log('  POST /agents/google-basic/invoke');
