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
 *     # With input
 *     curl -X POST http://localhost:8080/agents/langchain-basic/execute \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"input": "What is AI?"}}'
 *
 *     # Response: {"output": "AI (Artificial Intelligence) is..."}
 *
 *     # With messages (chat-style)
 *     curl -X POST http://localhost:8080/agents/langchain-basic/execute \
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

import { ChatOpenAI } from '@langchain/openai';
import { wrapAgent } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

// Create a LangChain chat model
const model = new ChatOpenAI({ model: 'gpt-4o-mini' });

// Wrap the model with the Reminix adapter
const agent = wrapAgent(model, 'langchain-basic');

// Serve the agent
serve({ agents: [agent], port: 8080 });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /info');
console.log('  POST /agents/langchain-basic/execute');
