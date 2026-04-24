/**
 * Anthropic SDK Agent — Claude served through Reminix.
 *
 * `AnthropicChatAgent` wraps an Anthropic SDK client so Reminix can invoke it
 * through a uniform agent interface. You get streaming, tool use, and
 * message-history handling without writing protocol glue.
 *
 * Invoke: POST /agents/anthropic-agent/invoke with { input: { prompt } } or
 * { input: { messages: [{ role, content }] } }.
 */

import Anthropic from '@anthropic-ai/sdk';
import { AnthropicChatAgent } from '@reminix/anthropic';
import { serve } from '@reminix/runtime';

const agent = new AnthropicChatAgent(new Anthropic(), {
  name: 'anthropic-agent',
  model: 'claude-sonnet-4-6',
});

serve({ agents: [agent] });
