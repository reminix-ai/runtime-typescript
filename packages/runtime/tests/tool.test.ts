/**
 * Tests for the tool() factory function.
 */

import { describe, it, expect } from 'vitest';
import { tool } from '../src/index.js';

describe('Tool Creation', () => {
  it('should create a tool with tool() factory', () => {
    const myTool = tool('my-tool', {
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      handler: async (args) => ({ result: args.name }),
    });

    expect(myTool.name).toBe('my-tool');
  });

  it('should set description correctly', () => {
    const myTool = tool('my-tool', {
      description: 'Get the current weather',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => ({}),
    });

    expect(myTool.metadata.description).toBe('Get the current weather');
  });

  it('should set inputSchema correctly', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        location: { type: 'string', description: 'City name' },
        units: { type: 'string', default: 'celsius' },
      },
      required: ['location'],
    };

    const myTool = tool('weather', {
      description: 'Get weather',
      inputSchema: schema,
      handler: async () => ({}),
    });

    expect(myTool.metadata.inputSchema).toEqual(schema);
  });
});

describe('Tool Metadata', () => {
  it('should include description in metadata', () => {
    const myTool = tool('my-tool', {
      description: 'My tool description',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    expect(myTool.metadata.description).toBe('My tool description');
  });

  it('should include inputSchema in metadata', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: schema,
      handler: async () => ({}),
    });

    expect(myTool.metadata.inputSchema).toEqual(schema);
  });

  it('should include outputSchema in metadata when provided', () => {
    const outputSchema = {
      type: 'object' as const,
      properties: {
        result: { type: 'string' },
        count: { type: 'number' },
      },
    };

    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: outputSchema,
      handler: async () => ({ result: 'ok', count: 42 }),
    });

    expect(myTool.metadata.outputSchema).toEqual(outputSchema);
  });

  it('should have default output schema when not provided', () => {
    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    expect(myTool.metadata.outputSchema).toEqual({ type: 'string' });
  });
});

describe('Tool Execute', () => {
  it('should call execute handler with arguments', async () => {
    const greet = tool('greet', {
      description: 'Greet someone',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      handler: async (args) => ({
        message: `Hello, ${args.name}!`,
      }),
    });

    const response = await greet.call({ arguments: { name: 'World' } });

    expect(response.output).toEqual({ message: 'Hello, World!' });
  });

  it('should handle sync execute functions', async () => {
    const add = tool('add', {
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
      handler: (args) => (args.a as number) + (args.b as number),
    });

    const response = await add.call({ arguments: { a: 2, b: 3 } });

    expect(response.output).toBe(5);
  });

  it('should pass context to execute handler', async () => {
    let receivedContext: Record<string, unknown> | undefined;

    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: { type: 'object', properties: {} },
      handler: async (args, context) => {
        receivedContext = context;
        return { done: true };
      },
    });

    await myTool.call({
      arguments: {},
      context: { user_id: '123' },
    });

    expect(receivedContext).toEqual({ user_id: '123' });
  });

  it('should handle multiple parameters', async () => {
    const createUser = tool('create-user', {
      description: 'Create a user',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
        required: ['name', 'age'],
      },
      handler: async (args) => ({
        user: {
          name: args.name,
          age: args.age,
          active: args.active ?? true,
        },
      }),
    });

    const response = await createUser.call({
      arguments: { name: 'Alice', age: 30, active: false },
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
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('Something went wrong');
      },
    });

    await expect(failingTool.call({ arguments: {} })).rejects.toThrow('Something went wrong');
  });

  it('should propagate non-Error exceptions to caller', async () => {
    const failingTool = tool('failing', {
      description: 'A tool that throws non-Error',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        throw 'string error';
      },
    });

    await expect(failingTool.call({ arguments: {} })).rejects.toBe('string error');
  });
});

describe('Tool with Complex Schema', () => {
  it('should handle nested object properties', async () => {
    const complexTool = tool('complex', {
      description: 'Tool with complex schema',
      inputSchema: {
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
      handler: async (args) => ({
        processed: true,
        user: args.user,
      }),
    });

    const response = await complexTool.call({
      arguments: {
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
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['items'],
      },
      handler: async (args) => ({
        count: (args.items as string[]).length,
        items: args.items,
      }),
    });

    const response = await arrayTool.call({
      arguments: { items: ['a', 'b', 'c'] },
    });

    expect(response.output).toEqual({
      count: 3,
      items: ['a', 'b', 'c'],
    });
  });
});
