/**
 * Custom Agent Example
 *
 * This example shows how to create a custom agent using the agent() factory
 * from @reminix/runtime.
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
 *     curl http://localhost:8080/manifest
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

import { agent, serve } from '@reminix/runtime';
import { z } from 'zod';

const inputSchema = z.object({
  message: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      })
    )
    .optional(),
});

// Create an agent with the agent() factory
const echo = agent('echo', {
  description: 'A simple echo agent that demonstrates the factory pattern',
  inputSchema,
  stream: true,
  handler: async function* (input, context) {
    const { messages } = input;

    let response: string;

    // Check if this is a chat-style request (has messages)
    if (messages && messages.length > 0) {
      const userMessage = messages[messages.length - 1].content;
      response = `You said: ${userMessage}`;
    } else {
      const message = input.message || '';
      const userId = context?.user_id;
      response = `Echo: ${message}`;
      if (userId) {
        response += ` (from user ${userId})`;
      }
    }

    // Stream the response word by word
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = i === 0 ? words[i] : ` ${words[i]}`;
      yield chunk;
    }
  },
});

// Start the server
console.log('Custom Agent Example');
console.log('='.repeat(40));
console.log(`Agent: ${echo.name}`);
console.log(`Streaming: ${echo.metadata.capabilities.streaming}`);
console.log();
console.log('Server running on http://localhost:8080');
console.log();
console.log('Endpoints:');
console.log('  GET  /health');
console.log('  GET  /manifest');
console.log('  POST /agents/echo/invoke');
console.log();

serve({ agents: [echo] });
