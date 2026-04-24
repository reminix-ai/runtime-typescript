/**
 * OpenAI SDK Agent — GPT served through Reminix.
 *
 * `OpenAIChatAgent` wraps an OpenAI SDK client so Reminix can invoke it
 * through a uniform agent interface. You get streaming, function calling, and
 * message-history handling without writing protocol glue.
 *
 * Invoke: POST /agents/openai-agent/invoke with { input: { prompt } } or
 * { input: { messages: [{ role, content }] } }.
 */

import OpenAI from 'openai';
import { OpenAIChatAgent } from '@reminix/openai';
import { serve } from '@reminix/runtime';

const agent = new OpenAIChatAgent(new OpenAI(), {
  name: 'openai-agent',
  model: 'gpt-4o-mini',
});

serve({ agents: [agent] });
