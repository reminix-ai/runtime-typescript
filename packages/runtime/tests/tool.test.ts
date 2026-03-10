/**
 * Tests for the tool() factory function.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
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

  it('should omit outputSchema when not provided', () => {
    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({}),
    });

    expect(myTool.metadata.outputSchema).toBeUndefined();
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

// ── Zod Schema Support ──────────────────────────────────────────────────────

describe('Tool with Zod Schema', () => {
  it('should accept a Zod input schema and convert to JSON Schema in metadata', () => {
    const greet = tool('greet', {
      description: 'Greet someone',
      inputSchema: z.object({
        name: z.string().describe('Name to greet'),
      }),
      handler: async ({ name }) => `Hello, ${name}!`,
    });

    expect(greet.name).toBe('greet');
    const meta = greet.metadata;
    expect(meta.inputSchema.type).toBe('object');
    expect((meta.inputSchema.properties as Record<string, { type: string }>).name.type).toBe(
      'string'
    );
    expect(meta.inputSchema.required).toContain('name');
  });

  it('should accept a Zod output schema', () => {
    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: z.object({ x: z.number() }),
      outputSchema: z.object({
        result: z.number(),
        label: z.string(),
      }),
      handler: async ({ x }) => ({ result: x * 2, label: 'doubled' }),
    });

    const meta = myTool.metadata;
    expect(meta.outputSchema).toBeDefined();
    expect(meta.outputSchema!.type).toBe('object');
    expect((meta.outputSchema!.properties as Record<string, { type: string }>).result.type).toBe(
      'number'
    );
  });

  it('should execute handler correctly with Zod schema', async () => {
    const add = tool('add', {
      description: 'Add two numbers',
      inputSchema: z.object({
        a: z.number(),
        b: z.number(),
      }),
      handler: async ({ a, b }) => a + b,
    });

    const response = await add.call({ arguments: { a: 3, b: 7 } });
    expect(response.output).toBe(10);
  });

  it('should validate input by default when Zod schema is used', async () => {
    const greet = tool('greet', {
      description: 'Greet',
      inputSchema: z.object({
        name: z.string(),
      }),
      handler: async ({ name }) => `Hello, ${name}!`,
    });

    // Invalid input: name should be string, not number
    await expect(greet.call({ arguments: { name: 123 } })).rejects.toThrow();
  });

  it('should skip validation when validate: false', async () => {
    const greet = tool('greet', {
      description: 'Greet',
      inputSchema: z.object({
        name: z.string(),
      }),
      validate: false,
      handler: async ({ name }) => `Hello, ${name}!`,
    });

    // Invalid input passes through without validation
    const response = await greet.call({ arguments: { name: 123 } });
    expect(response.output).toBe('Hello, 123!');
  });

  it('should not validate by default with JSON Schema', async () => {
    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      handler: async (args) => `Hello, ${args.name}!`,
    });

    // Invalid input passes through (no Zod validation for JSON Schema)
    const response = await myTool.call({ arguments: { name: 123 } });
    expect(response.output).toBe('Hello, 123!');
  });

  it('should preserve original Zod schema on tool instance', () => {
    const zodSchema = z.object({ name: z.string() });
    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: zodSchema,
      handler: async () => 'ok',
    });

    expect(myTool.inputZodSchema).toBe(zodSchema);
  });

  it('should have undefined Zod schema for JSON Schema tools', () => {
    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => 'ok',
    });

    expect(myTool.inputZodSchema).toBeUndefined();
    expect(myTool.outputZodSchema).toBeUndefined();
  });

  it('should handle optional fields in Zod schema', async () => {
    const myTool = tool('my-tool', {
      description: 'Test',
      inputSchema: z.object({
        required: z.string(),
        optional: z.number().optional(),
      }),
      handler: async ({ required: req, optional: opt }) => ({
        required: req,
        optional: opt ?? 'default',
      }),
    });

    const meta = myTool.metadata;
    expect(meta.inputSchema.required).toContain('required');
    expect(meta.inputSchema.required).not.toContain('optional');

    const response = await myTool.call({ arguments: { required: 'hello' } });
    expect(response.output).toEqual({ required: 'hello', optional: 'default' });
  });

  it('should handle complex Zod schemas (enums, arrays, nested)', async () => {
    const myTool = tool('complex', {
      description: 'Complex tool',
      inputSchema: z.object({
        role: z.enum(['admin', 'user']),
        tags: z.array(z.string()),
        config: z.object({ verbose: z.boolean() }).optional(),
      }),
      handler: async ({ role, tags }) => `${role}: ${tags.join(', ')}`,
    });

    const meta = myTool.metadata;
    const props = meta.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.role.enum).toEqual(['admin', 'user']);
    expect(props.tags.type).toBe('array');

    const response = await myTool.call({
      arguments: { role: 'admin', tags: ['a', 'b'] },
    });
    expect(response.output).toBe('admin: a, b');
  });
});
