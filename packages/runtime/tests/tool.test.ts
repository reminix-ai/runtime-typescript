/**
 * Tests for the tool() factory function and Tool class.
 */

import { describe, it, expect } from 'vitest';
import { tool, Tool, ToolBase, type ToolCallRequest } from '../src/index.js';

describe('Tool Creation', () => {
  it('should create a tool with tool() factory', () => {
    const myTool = tool('my-tool', {
      description: 'A test tool',
      input: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      handler: async (input) => ({ result: input.name }),
    });

    expect(myTool).toBeInstanceOf(Tool);
    expect(myTool.name).toBe('my-tool');
  });

  it('should set description correctly', () => {
    const myTool = tool('my-tool', {
      description: 'Get the current weather',
      input: {
        type: 'object',
        properties: {},
      },
      handler: async () => ({}),
    });

    expect(myTool.description).toBe('Get the current weather');
  });

  it('should set input correctly', () => {
    const inputSchema = {
      type: 'object' as const,
      properties: {
        location: { type: 'string', description: 'City name' },
        units: { type: 'string', default: 'celsius' },
      },
      required: ['location'],
    };

    const myTool = tool('weather', {
      description: 'Get weather',
      input: inputSchema,
      handler: async () => ({}),
    });

    expect(myTool.input).toEqual(inputSchema);
  });
});

describe('Tool Metadata', () => {
  it('should include description in metadata', () => {
    const myTool = tool('my-tool', {
      description: 'My tool description',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    expect(myTool.metadata.description).toBe('My tool description');
  });

  it('should include input in metadata', () => {
    const inputSchema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    const myTool = tool('my-tool', {
      description: 'Test',
      input: inputSchema,
      handler: async () => ({}),
    });

    expect(myTool.metadata.input).toEqual(inputSchema);
  });

  it('should include output in metadata when provided', () => {
    const outputSchema = {
      type: 'object' as const,
      properties: {
        result: { type: 'string' },
        count: { type: 'number' },
      },
    };

    const myTool = tool('my-tool', {
      description: 'Test',
      input: { type: 'object', properties: {} },
      output: outputSchema,
      handler: async () => ({ result: 'ok', count: 42 }),
    });

    expect(myTool.metadata.output).toEqual(outputSchema);
    expect(myTool.output).toEqual(outputSchema);
  });

  it('should have default output schema when not provided', () => {
    const myTool = tool('my-tool', {
      description: 'Test',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    expect(myTool.output).toEqual({ type: 'string' });
  });
});

describe('Tool Execute', () => {
  it('should call execute handler with input', async () => {
    const greet = tool('greet', {
      description: 'Greet someone',
      input: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      handler: async (input) => ({
        message: `Hello, ${input.name}!`,
      }),
    });

    const response = await greet.call({ input: { name: 'World' } });

    expect(response.output).toEqual({ message: 'Hello, World!' });
  });

  it('should handle sync execute functions', async () => {
    const add = tool('add', {
      description: 'Add two numbers',
      input: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
      handler: (input) => (input.a as number) + (input.b as number),
    });

    const response = await add.call({ input: { a: 2, b: 3 } });

    expect(response.output).toBe(5);
  });

  it('should pass context to execute handler', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const myTool = tool('my-tool', {
      description: 'Test',
      input: { type: 'object', properties: {} },
      handler: async (input, context) => {
        receivedContext = context;
        return { done: true };
      },
    });

    await myTool.call({
      input: {},
      context: { user_id: '123' },
    });

    expect(receivedContext).toEqual({ user_id: '123' });
  });

  it('should handle multiple parameters', async () => {
    const createUser = tool('create-user', {
      description: 'Create a user',
      input: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
        required: ['name', 'age'],
      },
      handler: async (input) => ({
        user: {
          name: input.name,
          age: input.age,
          active: input.active ?? true,
        },
      }),
    });

    const response = await createUser.call({
      input: { name: 'Alice', age: 30, active: false },
    });

    expect(response.output).toEqual({
      user: { name: 'Alice', age: 30, active: false },
    });
  });
});

describe('Tool Error Handling', () => {
  it('should propagate exceptions to caller', async () => {
    const failingTool = tool('failing', {
      description: 'A tool that fails',
      input: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('Something went wrong');
      },
    });

    await expect(failingTool.call({ input: {} })).rejects.toThrow('Something went wrong');
  });

  it('should propagate non-Error exceptions to caller', async () => {
    const failingTool = tool('failing', {
      description: 'A tool that throws non-Error',
      input: { type: 'object', properties: {} },
      handler: async () => {
        throw 'string error';
      },
    });

    await expect(failingTool.call({ input: {} })).rejects.toBe('string error');
  });
});

describe('Tool Inheritance', () => {
  it('should inherit from ToolBase', () => {
    const myTool = tool('my-tool', {
      description: 'Test',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    expect(myTool).toBeInstanceOf(ToolBase);
  });
});

describe('Tool with Complex Schema', () => {
  it('should handle nested object properties', async () => {
    const complexTool = tool('complex', {
      description: 'Tool with complex schema',
      input: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
          options: {
            type: 'object',
            properties: {
              notify: { type: 'boolean' },
            },
          },
        },
        required: ['user'],
      },
      handler: async (input) => ({
        processed: true,
        user: input.user,
      }),
    });

    const response = await complexTool.call({
      input: {
        user: { name: 'Alice', email: 'alice@example.com' },
        options: { notify: true },
      },
    });

    expect(response.output).toEqual({
      processed: true,
      user: { name: 'Alice', email: 'alice@example.com' },
    });
  });

  it('should handle array properties', async () => {
    const arrayTool = tool('array-tool', {
      description: 'Tool with array input',
      input: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['items'],
      },
      handler: async (input) => ({
        count: (input.items as string[]).length,
        items: input.items,
      }),
    });

    const response = await arrayTool.call({
      input: { items: ['a', 'b', 'c'] },
    });

    expect(response.output).toEqual({
      count: 3,
      items: ['a', 'b', 'c'],
    });
  });
});
