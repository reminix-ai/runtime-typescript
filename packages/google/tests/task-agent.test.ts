/**
 * Tests for the Google Gemini task agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { GoogleTaskAgent } from '../src/task-agent.js';

const SAMPLE_SCHEMA = {
  type: 'object',
  properties: {
    sentiment: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['sentiment', 'confidence'],
};

describe('GoogleTaskAgent', () => {
  it('should be instantiable', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleTaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });

    expect(agent).toBeInstanceOf(GoogleTaskAgent);
  });

  it('should accept custom options', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleTaskAgent(mockClient as any, {
      outputSchema: SAMPLE_SCHEMA,
      name: 'my-task-agent',
      model: 'gemini-2.5-pro',
    });

    expect(agent.name).toBe('my-task-agent');
    expect(agent.model).toBe('gemini-2.5-pro');
  });

  it('should use default values if not provided', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleTaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });

    expect(agent.name).toBe('google-task-agent');
    expect(agent.model).toBe('gemini-2.5-flash');
  });

  it('should have task type metadata', () => {
    const mockClient = { models: { generateContent: vi.fn() } };
    const agent = new GoogleTaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });

    expect(agent.metadata.type).toBe('task');
    expect(agent.metadata.inputSchema).toEqual(AGENT_TYPES['task'].inputSchema);
    expect(agent.metadata.outputSchema).toEqual(AGENT_TYPES['task'].outputSchema);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('GoogleTaskAgent.invoke', () => {
  it('should call the client', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'task_result',
                      args: { sentiment: 'positive', confidence: 0.95 },
                    },
                  },
                ],
              },
            },
          ],
        }),
      },
    };

    const agent = new GoogleTaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = { input: { task: 'Analyze sentiment' } };

    await agent.invoke(request);

    expect(mockClient.models.generateContent).toHaveBeenCalled();
  });

  it('should return structured output from function call', async () => {
    const result = { sentiment: 'positive', confidence: 0.95 };
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ functionCall: { name: 'task_result', args: result } }],
              },
            },
          ],
        }),
      },
    };

    const agent = new GoogleTaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = { input: { task: 'Analyze sentiment' } };

    const response = await agent.invoke(request);

    expect(response.output).toEqual(result);
  });

  it('should use function calling config to force tool use', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ functionCall: { name: 'task_result', args: {} } }],
              },
            },
          ],
        }),
      },
    };

    const agent = new GoogleTaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = { input: { task: 'Do something' } };

    await agent.invoke(request);

    const callArg = mockClient.models.generateContent.mock.calls[0][0];
    expect(callArg.config.toolConfig.functionCallingConfig.mode).toBe('ANY');
    expect(callArg.config.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual([
      'task_result',
    ]);
    expect(callArg.config.tools[0].functionDeclarations).toHaveLength(1);
    expect(callArg.config.tools[0].functionDeclarations[0].name).toBe('task_result');
    expect(callArg.config.tools[0].functionDeclarations[0].parameters).toEqual(SAMPLE_SCHEMA);
  });

  it('should use the configured model', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ functionCall: { name: 'task_result', args: {} } }],
              },
            },
          ],
        }),
      },
    };

    const agent = new GoogleTaskAgent(mockClient as any, {
      outputSchema: SAMPLE_SCHEMA,
      model: 'gemini-2.5-pro',
    });
    const request: AgentRequest = { input: { task: 'Do something' } };

    await agent.invoke(request);

    const callArg = mockClient.models.generateContent.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-2.5-pro');
  });

  it('should include extra context in prompt', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ functionCall: { name: 'task_result', args: {} } }],
              },
            },
          ],
        }),
      },
    };

    const agent = new GoogleTaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = {
      input: { task: 'Analyze', text: 'Hello world', language: 'en' },
    };

    await agent.invoke(request);

    const callArg = mockClient.models.generateContent.mock.calls[0][0];
    const prompt = callArg.contents[0].parts[0].text;
    expect(prompt).toContain('Hello world');
    expect(prompt).toContain('language');
  });

  it('should return empty object if no function call', async () => {
    const mockClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ text: 'Some text' }],
              },
            },
          ],
        }),
      },
    };

    const agent = new GoogleTaskAgent(mockClient as any, { outputSchema: SAMPLE_SCHEMA });
    const request: AgentRequest = { input: { task: 'Do something' } };

    const response = await agent.invoke(request);

    expect(response.output).toEqual({});
  });
});
