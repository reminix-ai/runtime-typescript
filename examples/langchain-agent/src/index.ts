/**
 * LangChain Agent — LangChain.js served through Reminix.
 *
 * `LangChainChatAgent` adapts a LangChain chat model (or any Runnable) into a
 * Reminix-compatible agent. Use it to serve existing LangChain compositions
 * as a streaming REST API without rewriting them.
 *
 * Invoke: POST /agents/langchain-agent/invoke with { input: { prompt } } or
 * { input: { messages: [{ role, content }] } }.
 */

import { ChatOpenAI } from '@langchain/openai';
import { LangChainChatAgent } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

const agent = new LangChainChatAgent(new ChatOpenAI({ model: 'gpt-4o-mini' }), {
  name: 'langchain-agent',
});

serve({ agents: [agent] });
