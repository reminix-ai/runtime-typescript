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
 *     # Execute endpoint
 *     curl -X POST http://localhost:8080/agents/echo/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"message": "Hello!"}}'
 *
 *     # Response: {"output": "Echo: Hello!"}
 *
 *     # Execute with messages (chat-style)
 *     curl -X POST http://localhost:8080/agents/echo/invoke \
 *       -H "Content-Type: application/json" \
 *       -d '{"input": {"messages": [{"role": "user", "content": "Hello!"}]}}'
 *
 *     # Response: {"output": "You said: Hello!"}
 *
 *     # Streaming execute
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

// Register execute handler
agent.handler(async (request) => {
  const input = request.input as Record<string, unknown>;

  // Check if this is a chat-style request (has messages)
  if (input.messages && Array.isArray(input.messages)) {
    const messages = input.messages as Array<{ role: string; content: string }>;
    const userMessage = messages.length > 0 ? messages[messages.length - 1].content : '';
    return { output: `You said: ${userMessage}` };
  }

  // Otherwise treat as task-style request
  const message = (input.message as string) || '';

  // Access optional context
  const userId = request.context?.user_id;

  let output = `Echo: ${message}`;
  if (userId) {
    output += ` (from user ${userId})`;
  }

  return { output };
});

// Register streaming execute handler
agent.streamHandler(async function* (request) {
  const input = request.input as Record<string, unknown>;

  let response: string;

  // Check if this is a chat-style request (has messages)
  if (input.messages && Array.isArray(input.messages)) {
    const messages = input.messages as Array<{ role: string; content: string }>;
    const userMessage = messages.length > 0 ? messages[messages.length - 1].content : '';
    response = `You said: ${userMessage}`;
  } else {
    const message = (input.message as string) || '';
    response = `Echo: ${message}`;
  }

  // Stream the response word by word
  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    const chunk = i === 0 ? words[i] : ` ${words[i]}`;
    yield JSON.stringify({ chunk });
  }
});

// Start the server
console.log('Custom Agent Example');
console.log('='.repeat(40));
console.log(`Agent: ${agent.name}`);
console.log(`Streaming: ${agent.streaming}`);
console.log();
console.log('Server running on http://localhost:8080');
console.log();
console.log('Endpoints:');
console.log('  GET  /health');
console.log('  GET  /info');
console.log('  POST /agents/echo/invoke');
console.log();

serve({ agents: [agent], port: 8080 });
