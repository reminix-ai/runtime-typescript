/**
 * Starter Agent — the fastest way to try Reminix.
 *
 * Defines a minimal agent with the `agent()` factory and serves it as a REST
 * API. No API keys, no external SDKs — just the runtime itself. Use this as a
 * starting point for your own agent.
 *
 * Invoke: POST /agents/starter-agent/invoke with { input: { message } }.
 */

import { agent, serve } from '@reminix/runtime';
import { z } from 'zod';

const starter = agent('starter-agent', {
  description: 'A minimal starter agent',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.string(),
  handler: async ({ message }) => `You said: ${message}`,
});

serve({ agents: [starter] });
