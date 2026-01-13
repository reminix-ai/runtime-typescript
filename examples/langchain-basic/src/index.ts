/**
 * Basic LangChain agent example
 *
 * This example shows how to create a simple LangChain agent
 * and serve it via Reminix Runtime.
 *
 * Usage:
 *     npx tsx src/index.ts
 *
 * Then test the endpoints:
 *
 *     # Invoke endpoint (task-oriented)
 *     curl -X POST http://localhost:8080/agents/langchain-basic/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"query": "What is AI?"}}'
 *
 *     # Response: {"output": "..."}
 *
 *     # Chat endpoint (conversational)
 *     curl -X POST http://localhost:8080/agents/langchain-basic/chat \
 *       -H "Content-Type: application/json" \
 *       -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
 *
 *     # Response: {"output": "...", "messages": [...]}
 */

import { serve } from '@reminix/runtime';
import { wrap } from '@reminix/langchain';
// import { ChatOpenAI } from '@langchain/openai';

// Example: Create a LangChain agent
// const model = new ChatOpenAI({ model: 'gpt-4o' });
// const agent = createReactAgent({ llm: model, tools: [...] });

/**
 * A mock runnable that behaves like a LangChain model.
 * In production, replace this with a real LangChain model or chain.
 */
const agent = {
  invoke: async (input: unknown) => {
    // For invoke: receives arbitrary input, returns result
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const query = (input as Record<string, unknown>).query || JSON.stringify(input);
      return { content: `You asked: ${query}` };
    }
    // For chat: receives list of messages, returns AI message
    if (Array.isArray(input)) {
      return { content: 'Hello from LangChain!' };
    }
    return { content: String(input) };
  },
} as Parameters<typeof wrap>[0];

// Wrap the agent with the Reminix adapter
const wrappedAgent = wrap(agent, 'langchain-basic');

// Serve the agent
serve([wrappedAgent], { port: 8080 });

console.log('Server running on http://localhost:8080');
console.log('\nEndpoints:');
console.log('  GET  /health');
console.log('  GET  /info');
console.log('  POST /agents/langchain-basic/invoke');
console.log('  POST /agents/langchain-basic/chat');
