/**
 * Tests for the Vercel AI SDK task agent.
 */

import { describe, it, expect, vi } from 'vitest';

import type { AgentRequest } from '@reminix/runtime';
import { AGENT_TYPES } from '@reminix/runtime';
import { VercelAITaskAgent } from '../src/task-agent.js';

describe('VercelAITaskAgent', () => {
  it('should be instantiable with a LanguageModel', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAITaskAgent(mockModel as any);
    expect(agent).toBeInstanceOf(VercelAITaskAgent);
  });

  it('should be instantiable with a ToolLoopAgent', () => {
    const mockAgent = { generate: vi.fn(), stream: vi.fn() };
    const agent = new VercelAITaskAgent(mockAgent as any);
    expect(agent).toBeInstanceOf(VercelAITaskAgent);
  });

  it('should accept custom options', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAITaskAgent(mockModel as any, { name: 'my-task-agent' });
    expect(agent.name).toBe('my-task-agent');
  });

  it('should use default values if not provided', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAITaskAgent(mockModel as any);
    expect(agent.name).toBe('vercel-ai-task-agent');
  });

  it('should have task type metadata', () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAITaskAgent(mockModel as any);
    expect(agent.metadata.type).toBe('task');
    expect(agent.metadata.inputSchema).toEqual(AGENT_TYPES['task'].inputSchema);
    expect(agent.metadata.outputSchema).toEqual(AGENT_TYPES['task'].outputSchema);
    expect(agent.metadata.capabilities.streaming).toBe(false);
  });
});

describe('VercelAITaskAgent.invoke with LanguageModel', () => {
  it('should call generateText with task prompt', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAITaskAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: '{"result": "done"}',
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { task: 'Summarize this document' },
    };

    await agent.invoke(request);

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const callArg = mockGenerateText.mock.calls[0][0];
    expect(callArg.model).toBe(mockModel);
    expect(callArg.prompt).toBe('Summarize this document');
  });

  it('should parse JSON output from text', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAITaskAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: '{"summary": "This is a summary", "confidence": 0.95}',
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { task: 'Summarize' },
    };

    const result = await agent.invoke(request);

    expect(result.output).toEqual({ summary: 'This is a summary', confidence: 0.95 });
  });

  it('should return plain text if not valid JSON', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAITaskAgent(mockModel as any);

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: 'Just a plain text response',
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { task: 'Do something' },
    };

    const result = await agent.invoke(request);

    expect(result.output).toBe('Just a plain text response');
  });

  it('should apply instructions as system prompt', async () => {
    const mockModel = { modelId: 'gpt-4o' };
    const agent = new VercelAITaskAgent(mockModel as any, {
      instructions: 'Always respond in JSON',
    });

    const mockGenerateText = vi.fn().mockResolvedValue({
      text: '{"ok": true}',
    });
    (agent as any)._generateText = mockGenerateText;

    const request: AgentRequest = {
      input: { task: 'Test' },
    };

    await agent.invoke(request);

    const callArg = mockGenerateText.mock.calls[0][0];
    expect(callArg.system).toBe('Always respond in JSON');
  });
});

describe('VercelAITaskAgent.invoke with ToolLoopAgent', () => {
  it('should call agent.generate with prompt', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      text: 'Done',
      output: { status: 'completed' },
    });
    const mockAgent = { generate: mockGenerate, stream: vi.fn() };
    const agent = new VercelAITaskAgent(mockAgent as any);

    const request: AgentRequest = {
      input: { task: 'Process data' },
    };

    await agent.invoke(request);

    expect(mockGenerate).toHaveBeenCalledOnce();
    const callArg = mockGenerate.mock.calls[0][0];
    expect(callArg.prompt).toBe('Process data');
  });

  it('should prefer structured output from ToolLoopAgent', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      text: 'Done processing',
      output: { status: 'completed', items: 5 },
    });
    const mockAgent = { generate: mockGenerate, stream: vi.fn() };
    const agent = new VercelAITaskAgent(mockAgent as any);

    const request: AgentRequest = {
      input: { task: 'Process data' },
    };

    const result = await agent.invoke(request);

    expect(result.output).toEqual({ status: 'completed', items: 5 });
  });

  it('should fall back to text if no structured output', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      text: 'Plain result',
    });
    const mockAgent = { generate: mockGenerate, stream: vi.fn() };
    const agent = new VercelAITaskAgent(mockAgent as any);

    const request: AgentRequest = {
      input: { task: 'Do it' },
    };

    const result = await agent.invoke(request);

    expect(result.output).toBe('Plain result');
  });
});
