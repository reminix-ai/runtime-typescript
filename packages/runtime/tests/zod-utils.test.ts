/**
 * Tests for Zod schema detection and conversion utilities.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { isZodSchema, zodToJSONSchema, resolveSchema } from '../src/zod-utils.js';
import type { JSONSchema } from '../src/types.js';

describe('isZodSchema', () => {
  it('should detect a Zod object schema', () => {
    expect(isZodSchema(z.object({ name: z.string() }))).toBe(true);
  });

  it('should detect a Zod string schema', () => {
    expect(isZodSchema(z.string())).toBe(true);
  });

  it('should detect a Zod number schema', () => {
    expect(isZodSchema(z.number())).toBe(true);
  });

  it('should detect a Zod array schema', () => {
    expect(isZodSchema(z.array(z.string()))).toBe(true);
  });

  it('should detect a Zod enum schema', () => {
    expect(isZodSchema(z.enum(['a', 'b']))).toBe(true);
  });

  it('should return false for a plain JSON Schema object', () => {
    const jsonSchema: JSONSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    expect(isZodSchema(jsonSchema)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isZodSchema(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isZodSchema(undefined)).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isZodSchema('hello')).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isZodSchema(42)).toBe(false);
  });
});

describe('zodToJSONSchema', () => {
  it('should convert a simple object schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const result = zodToJSONSchema(schema);

    expect(result.type).toBe('object');
    expect(result.properties).toBeDefined();
    expect((result.properties as Record<string, { type: string }>).name.type).toBe('string');
    expect((result.properties as Record<string, { type: string }>).age.type).toBe('number');
    expect(result.required).toContain('name');
    expect(result.required).toContain('age');
  });

  it('should strip the $schema key', () => {
    const schema = z.object({ x: z.string() });
    const result = zodToJSONSchema(schema);

    expect(result.$schema).toBeUndefined();
  });

  it('should preserve descriptions', () => {
    const schema = z.object({
      city: z.string().describe('City name'),
    });
    const result = zodToJSONSchema(schema);

    expect((result.properties as Record<string, { description?: string }>).city.description).toBe(
      'City name'
    );
  });

  it('should handle optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.number().optional(),
    });
    const result = zodToJSONSchema(schema);

    expect(result.required).toContain('required');
    expect(result.required).not.toContain('optional');
  });

  it('should handle enums', () => {
    const schema = z.object({
      role: z.enum(['admin', 'user', 'guest']),
    });
    const result = zodToJSONSchema(schema);

    const roleProp = (result.properties as Record<string, { enum?: string[] }>).role;
    expect(roleProp.enum).toEqual(['admin', 'user', 'guest']);
  });

  it('should handle arrays', () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });
    const result = zodToJSONSchema(schema);

    const tagsProp = (
      result.properties as Record<string, { type: string; items?: { type: string } }>
    ).tags;
    expect(tagsProp.type).toBe('array');
    expect(tagsProp.items?.type).toBe('string');
  });

  it('should handle nested objects', () => {
    const schema = z.object({
      address: z.object({
        city: z.string(),
        zip: z.string(),
      }),
    });
    const result = zodToJSONSchema(schema);

    const addressProp = (
      result.properties as Record<string, { type: string; properties?: Record<string, unknown> }>
    ).address;
    expect(addressProp.type).toBe('object');
    expect(addressProp.properties).toBeDefined();
  });

  it('should convert a non-object schema (string)', () => {
    const result = zodToJSONSchema(z.string());
    expect(result.type).toBe('string');
  });

  it('should convert a non-object schema (number)', () => {
    const result = zodToJSONSchema(z.number());
    expect(result.type).toBe('number');
  });
});

describe('resolveSchema', () => {
  it('should pass through JSON Schema as-is', () => {
    const jsonSchema: JSONSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const { jsonSchema: result, zodSchema } = resolveSchema(jsonSchema);

    expect(result).toBe(jsonSchema); // same reference
    expect(zodSchema).toBeUndefined();
  });

  it('should convert Zod schema to JSON Schema and preserve original', () => {
    const zodInput = z.object({ name: z.string() });
    const { jsonSchema, zodSchema } = resolveSchema(zodInput);

    expect(jsonSchema.type).toBe('object');
    expect((jsonSchema.properties as Record<string, { type: string }>).name.type).toBe('string');
    expect(zodSchema).toBe(zodInput); // same reference to original
  });
});
