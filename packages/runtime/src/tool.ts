/**
 * Reminix Runtime Tool definitions
 */

import type { z } from 'zod';
import type {
  ToolRequest,
  ToolResponse,
  JSONSchema,
  SchemaInput,
  InferSchema,
  InferOutput,
} from './types.js';
import { resolveSchema } from './zod-utils.js';

// === ToolMetadata ===

/** Metadata for a tool */
export interface ToolMetadata {
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  tags?: string[];
  [key: string]: unknown;
}

/** Handler function type */
export type ToolHandler = (
  args: Record<string, unknown>,
  context?: Record<string, unknown>
) => Promise<unknown> | unknown;

// === Tool Base Class ===

/**
 * Abstract base class for all tools.
 *
 * The tool() factory creates a private _FunctionTool subclass internally.
 */
export abstract class Tool {
  private _name: string;
  private _description: string;
  private _inputSchema: JSONSchema;
  private _outputSchema: JSONSchema | undefined;
  private _inputZodSchema: z.ZodType | undefined;
  private _outputZodSchema: z.ZodType | undefined;
  private _tags: string[] | undefined;
  private _extraMetadata: Record<string, unknown> | undefined;

  constructor(
    name: string,
    options: {
      description?: string;
      inputSchema?: JSONSchema;
      outputSchema?: JSONSchema;
      inputZodSchema?: z.ZodType;
      outputZodSchema?: z.ZodType;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    this._name = name;
    this._description = options.description ?? '';
    this._inputSchema = options.inputSchema ?? { type: 'object', properties: {} };
    this._outputSchema = options.outputSchema;
    this._inputZodSchema = options.inputZodSchema;
    this._outputZodSchema = options.outputZodSchema;
    this._tags = options.tags;
    this._extraMetadata = options.metadata;
  }

  get name(): string {
    return this._name;
  }

  /** Returns the original Zod input schema, if the tool was created with one. */
  get inputZodSchema(): z.ZodType | undefined {
    return this._inputZodSchema;
  }

  /** Returns the original Zod output schema, if the tool was created with one. */
  get outputZodSchema(): z.ZodType | undefined {
    return this._outputZodSchema;
  }

  get metadata(): ToolMetadata {
    const result: ToolMetadata = {
      description: this._description,
      inputSchema: this._inputSchema,
    };
    if (this._outputSchema) {
      result.outputSchema = this._outputSchema;
    }
    if (this._tags) {
      result.tags = this._tags;
    }
    if (this._extraMetadata) {
      Object.assign(result, this._extraMetadata);
    }
    return result;
  }

  abstract call(request: ToolRequest): Promise<ToolResponse>;
}

// === Tool Options ===

/** Options for creating a tool — accepts JSON Schema or Zod for inputSchema / outputSchema. */
export interface ToolOptions<
  TInput extends SchemaInput = JSONSchema,
  TOutput extends SchemaInput = JSONSchema,
> {
  /** Human-readable description of what the tool does */
  description: string;
  /** Schema for input (JSON Schema object or Zod schema) */
  inputSchema: TInput;
  /** Optional schema for output (JSON Schema object or Zod schema) */
  outputSchema?: TOutput;
  /** Optional list of tags for categorization */
  tags?: string[];
  /** Optional extra metadata */
  metadata?: Record<string, unknown>;
  /**
   * Whether to validate inputs at runtime using the Zod schema.
   * Defaults to `true` when inputSchema is a Zod schema, `false` otherwise.
   */
  validate?: boolean;
  /** Handler function to execute when the tool is called */
  handler: (
    args: InferSchema<TInput>,
    context?: Record<string, unknown>
  ) => Promise<InferOutput<TOutput>> | InferOutput<TOutput>;
}

// === tool() factory ===

/**
 * Factory function to create a tool.
 *
 * @example
 * ```typescript
 * import { tool } from '@reminix/runtime';
 * import { z } from 'zod';
 *
 * // With Zod schema (recommended) — typed handler, runtime validation
 * const getWeather = tool('get_weather', {
 *   description: 'Get current weather for a location',
 *   inputSchema: z.object({
 *     location: z.string().describe('City name'),
 *     units: z.enum(['celsius', 'fahrenheit']).optional(),
 *   }),
 *   handler: async ({ location, units }) => {
 *     return { temp: 22, condition: 'sunny' };
 *   },
 * });
 *
 * // With JSON Schema (still supported)
 * const legacyTool = tool('legacy', {
 *   description: 'Legacy tool',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       location: { type: 'string', description: 'City name' },
 *     },
 *     required: ['location'],
 *   },
 *   handler: async (args) => {
 *     const location = args.location as string;
 *     return { temp: 22, condition: 'sunny' };
 *   },
 * });
 * ```
 */
export function tool<TInput extends SchemaInput, TOutput extends SchemaInput = JSONSchema>(
  name: string,
  options: ToolOptions<TInput, TOutput>
): Tool {
  const inputResolved = resolveSchema(options.inputSchema);
  const outputResolved = options.outputSchema ? resolveSchema(options.outputSchema) : undefined;
  const shouldValidate = options.validate ?? inputResolved.zodSchema !== undefined;

  return new _FunctionTool(name, {
    description: options.description,
    inputSchema: inputResolved.jsonSchema,
    outputSchema: outputResolved?.jsonSchema,
    inputZodSchema: inputResolved.zodSchema,
    outputZodSchema: outputResolved?.zodSchema,
    tags: options.tags,
    metadata: options.metadata,
    handler: options.handler as ToolHandler,
    validate: shouldValidate,
  });
}

// === _FunctionTool (private) ===

class _FunctionTool extends Tool {
  private _handler: ToolHandler;
  private _validate: boolean;
  private _validationSchema: z.ZodType | undefined;

  constructor(
    name: string,
    options: {
      description: string;
      inputSchema: JSONSchema;
      outputSchema?: JSONSchema;
      inputZodSchema?: z.ZodType;
      outputZodSchema?: z.ZodType;
      tags?: string[];
      metadata?: Record<string, unknown>;
      handler: ToolHandler;
      validate: boolean;
    }
  ) {
    super(name, {
      description: options.description,
      inputSchema: options.inputSchema,
      outputSchema: options.outputSchema,
      inputZodSchema: options.inputZodSchema,
      outputZodSchema: options.outputZodSchema,
      tags: options.tags,
      metadata: options.metadata,
    });
    this._handler = options.handler;
    this._validate = options.validate;
    this._validationSchema = options.inputZodSchema;
  }

  async call(request: ToolRequest): Promise<ToolResponse> {
    let args = request.arguments;
    if (this._validate && this._validationSchema) {
      args = this._validationSchema.parse(args) as Record<string, unknown>;
    }
    const result = await this._handler(args, request.context);
    return { output: result };
  }
}
