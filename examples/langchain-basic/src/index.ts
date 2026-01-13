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

// For now, we'll use a placeholder
const agent = {
  invoke: async (input: unknown) => {
    return { messages: [{ role: 'assistant', content: 'Hello from LangChain!' }] };
  },
};

// Wrap the agent with the Reminix adapter
const wrappedAgent = wrap(agent, 'langchain-basic');

// Serve the agent
serve([wrappedAgent], { port: 8080 });

console.log('Server running on http://localhost:8080');
