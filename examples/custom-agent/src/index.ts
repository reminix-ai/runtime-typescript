/**
 * Custom Agent Example
 *
 * This example shows how to create a custom agent using the callback-based
 * Agent class from @reminix/runtime.
 *
 * Usage:
 *     npx tsx src/index.ts
 *
 * Then test the endpoints:
 *
 *     # Health check
 *     curl http://localhost:8080/health
 *
 *     # Discovery
 *     curl http://localhost:8080/info
 *
 *     # Invoke endpoint (task-oriented)
 *     curl -X POST http://localhost:8080/agents/echo/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"message": "Hello!"}}'
 *
 *     # Response: {"output": "Echo: Hello!"}
 *
 *     # Chat endpoint (conversational)
 *     curl -X POST http://localhost:8080/agents/echo/chat \
 *       -H "Content-Type: application/json" \
 *       -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
 *
 *     # Response: {"output": "You said: Hello!", "messages": [...]}
 *
 *     # Streaming invoke
 *     curl -X POST http://localhost:8080/agents/echo/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"message": "Hello!"}, "stream": true}'
 */

import { Agent, serve } from '@reminix/runtime';

// Create an agent with metadata
const agent = new Agent('echo', {
  metadata: {
    description: 'A simple echo agent that demonstrates the callback pattern',
    version: '1.0.0',
  },
});

// Register invoke handler - task-oriented operations
agent.onInvoke(async (request) => {
  const message = (request.input as Record<string, string>).message || '';

  // Access optional context
  const userId = request.context?.user_id;

  let output = `Echo: ${message}`;
  if (userId) {
    output += ` (from user ${userId})`;
  }

  return { output };
});

// Register chat handler - conversational interactions
agent.onChat(async (request) => {
  // Get the last user message
  const userMessage =
    request.messages.length > 0 ? request.messages[request.messages.length - 1].content : '';

  const response = `You said: ${userMessage}`;

  return {
    output: response,
    messages: [...request.messages, { role: 'assistant', content: response }],
  };
});

// Register streaming invoke handler
agent.onInvokeStream(async function* (request) {
  const message = (request.input as Record<string, string>).message || '';

  // Stream the response word by word
  const words = `Echo: ${message}`.split(' ');
  for (let i = 0; i < words.length; i++) {
    const chunk = i === 0 ? words[i] : ` ${words[i]}`;
    yield JSON.stringify({ chunk });
  }
});

// Register streaming chat handler
agent.onChatStream(async function* (request) {
  const userMessage =
    request.messages.length > 0 ? request.messages[request.messages.length - 1].content : '';

  // Stream the response word by word
  const words = `You said: ${userMessage}`.split(' ');
  for (let i = 0; i < words.length; i++) {
    const chunk = i === 0 ? words[i] : ` ${words[i]}`;
    yield JSON.stringify({ chunk });
  }
});

// Start the server
console.log('Custom Agent Example');
console.log('='.repeat(40));
console.log(`Agent: ${agent.name}`);
console.log(`Invoke streaming: ${agent.invokeStreaming}`);
console.log(`Chat streaming: ${agent.chatStreaming}`);
console.log();
console.log('Server running on http://localhost:8080');
console.log();
console.log('Endpoints:');
console.log('  GET  /health');
console.log('  GET  /info');
console.log('  POST /agents/echo/invoke');
console.log('  POST /agents/echo/chat');
console.log();

serve({ agents: [agent], port: 8080 });
