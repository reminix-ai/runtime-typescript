/**
 * Basic LangChain agent example
 *
 * This example shows how to create a simple LangChain agent
 * and serve it via Reminix Runtime.
 *
 * Requirements:
 *     npm install @reminix/langchain @langchain/openai dotenv
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
 *     # Invoke endpoint (task-oriented)
 *     curl -X POST http://localhost:8080/agents/langchain-basic/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"input": "What is AI?"}}'
 *
 *     # Response: {"output": "AI (Artificial Intelligence) is..."}
 *
 *     # Chat endpoint (conversational)
 *     curl -X POST http://localhost:8080/agents/langchain-basic/chat \
 *       -H "Content-Type: application/json" \
 *       -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
 *
 *     # Response: {"output": "Hello! How can I help you today?", "messages": [...]}
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { ChatOpenAI } from '@langchain/openai';
import { wrap } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

// Create a LangChain chat model
const model = new ChatOpenAI({ model: 'gpt-4o-mini' });

// Wrap the model with the Reminix adapter
const agent = wrap(model, 'langchain-basic');

// Serve the agent
serve([agent], { port: 8080 });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /info');
console.log('  POST /agents/langchain-basic/invoke');
console.log('  POST /agents/langchain-basic/chat');
