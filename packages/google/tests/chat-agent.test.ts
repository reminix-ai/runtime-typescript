/**
 * Tests for the Google Gemini chat agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { GoogleChatAgent } from '../src/chat-agent.js';

describe('GoogleChatAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleChatAgent(mockClient as any);

    expect(agent).toBeInstanceOf(GoogleChatAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleChatAgent(mockClient as any, {
      name: 'my-agent',
      model: 'gemini-2.5-pro',
    });

    expect(agent.name).toBe('my-agent');
    expect(agent.model).toBe('gemini-2.5-pro');
  });

  it('should use default values if not provided', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleChatAgent(mockClient as any);

    expect(agent.name).toBe('google-agent');
    expect(agent.model).toBe('gemini-2.5-flash');
  });

  it('should have chat type metadata', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleChatAgent(mockClient as any);

    expect(agent.metadata.type).toBe('chat');
    expect(agent.metadata.input).toEqual(AGENT_TYPES['chat'].input);
  });
});

describe('GoogleChatAgent.invoke', () => {
  it('should call the client', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'Hello!',
        }),
      },
    };

    const agent = new GoogleChatAgent(mockClient as any);
    const request: AgentRequest = { input: { prompt: 'Hi' } };

    await agent.invoke(request);

    expect(mockClient.models.generateContent).toHaveBeenCalled();
  });

  it('should return output', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'Hello from Gemini!',
        }),
      },
    };

    const agent = new GoogleChatAgent(mockClient as any);
    const request: AgentRequest = { input: { prompt: 'Hi' } };

    const response = await agent.invoke(request);

    expect(response.output).toBe('Hello from Gemini!');
  });

  it('should handle messages input', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'Response',
        }),
      },
    };

    const agent = new GoogleChatAgent(mockClient as any);
    const request: AgentRequest = {
      input: { messages: [{ role: 'user', content: 'Hello' }] },
    };

    await agent.invoke(request);

    expect(mockClient.models.generateContent).toHaveBeenCalled();
  });

  it('should extract system message as systemInstruction', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'Response',
        }),
      },
    };

    const agent = new GoogleChatAgent(mockClient as any);
    const request: AgentRequest = {
      input: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
        ],
      },
    };

    await agent.invoke(request);

    const callArg = mockClient.models.generateContent.mock.calls[0][0];
    expect(callArg.config.systemInstruction).toBe('You are helpful');
    expect(callArg.contents.every((c: any) => c.role !== 'system')).toBe(true);
  });

  it('should map assistant role to model', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'Response',
        }),
      },
    };

    const agent = new GoogleChatAgent(mockClient as any);
    const request: AgentRequest = {
      input: {
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'How are you?' },
        ],
      },
    };

    await agent.invoke(request);

    const callArg = mockClient.models.generateContent.mock.calls[0][0];
    expect(callArg.contents[1].role).toBe('model');
  });
});
