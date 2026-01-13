/**
 * Basic LangChain agent example
 *
 * This example shows how to create a simple LangChain agent
 * and serve it via Reminix Runtime.
 */

import { serve } from '@reminix/runtime';
import { wrap } from '@reminix/langchain';
// import { ChatOpenAI } from '@langchain/openai';

// Example: Create a LangChain agent
// const model = new ChatOpenAI({ model: 'gpt-4o' });
// const agent = createReactAgent({ llm: model, tools: [...] });

// For now, we'll use a placeholder that mimics a LangChain Runnable
// In production, you'd use a real LangChain model or chain
const agent = {
  invoke: async (input: unknown) => {
    return { content: 'Hello from LangChain!' };
  },
} as Parameters<typeof wrap>[0];

// Wrap the agent with the Reminix adapter
const wrappedAgent = wrap(agent, 'langchain-basic');

// Serve the agent
serve([wrappedAgent], { port: 8080 });

console.log('Server running on http://localhost:8080');
