/**
 * Google Gemini Agent — Gemini served through Reminix.
 *
 * `GoogleChatAgent` wraps a GoogleGenAI client so Reminix can invoke it
 * through the uniform Agent interface. The adapter translates Reminix
 * invoke requests into Gemini generate-content calls and streams responses
 * back — you get tool use and message-history handling without writing
 * any protocol glue.
 *
 * Invoke: POST /agents/gemini-agent/invoke with { input: { prompt } } or
 * { input: { messages: [{ role, content }] } }.
 */

import { GoogleGenAI } from '@google/genai';
import { GoogleChatAgent } from '@reminix/google';
import { serve } from '@reminix/runtime';

const agent = new GoogleChatAgent(new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY }), {
  name: 'gemini-agent',
  model: 'gemini-2.5-flash',
});

serve({ agents: [agent] });
