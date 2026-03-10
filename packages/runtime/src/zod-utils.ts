/**
 * Zod schema detection and conversion utilities.
 *
 * Allows tool() and agent() factories to accept either JSON Schema or Zod schemas.
 * Zod schemas are converted to JSON Schema internally for the manifest/wire format.
 */

import type { z } from 'zod';
import { toJSONSchema } from 'zod';
import type { JSONSchema } from './types.js';

/**
 * Runtime check: is the value a Zod schema instance?
 */
export function isZodSchema(value: unknown): value is z.ZodType {
  return (
    value !== null &&
    typeof value === 'object' &&
    '_zod' in value &&
    typeof (value as Record<string, unknown>)._zod === 'object'
  );
}

/**
 * Convert a Zod schema to a JSON Schema object.
 *
 * Strips the `$schema` meta-key so the output matches our JSONSchema interface
 * (plain property descriptors, no draft URI).
 */
export function zodToJSONSchema(schema: z.ZodType): JSONSchema {
  const raw = toJSONSchema(schema) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...rest } = raw;
  return rest as JSONSchema;
}

/**
 * Normalise a schema input that may be either JSON Schema or a Zod type.
 *
 * Returns the canonical JSON Schema representation *and* the original Zod
 * schema (when one was provided) so callers can use it for validation / MCP.
 */
export function resolveSchema(schema: JSONSchema | z.ZodType): {
  jsonSchema: JSONSchema;
  zodSchema: z.ZodType | undefined;
} {
  if (isZodSchema(schema)) {
    return {
      jsonSchema: zodToJSONSchema(schema),
      zodSchema: schema,
    };
  }
  return { jsonSchema: schema as JSONSchema, zodSchema: undefined };
}
