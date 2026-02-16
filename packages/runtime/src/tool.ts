/**
 * Reminix Runtime Tool definitions
 */

import type { ToolRequest, ToolResponse, JSONSchema } from './types.js';

/**
 * Default output schema for tools.
 */
const DEFAULT_TOOL_OUTPUT: JSONSchema = {
  type: 'string',
};

// === ToolMetadata ===

/** Metadata for a tool */
export interface ToolMetadata {
  description: string;
  input: JSONSchema;
  output: JSONSchema;
  tags?: string[];
  [key: string]: unknown;
}

/** Handler function type */
export type ToolHandler = (
  input: Record<string, unknown>,
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
  private _outputSchema: JSONSchema;
  private _tags: string[] | undefined;
  private _extraMetadata: Record<string, unknown> | undefined;

  constructor(
    name: string,
    options: {
      description?: string;
      inputSchema?: JSONSchema;
      outputSchema?: JSONSchema;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    this._name = name;
    this._description = options.description ?? '';
    this._inputSchema = options.inputSchema ?? { type: 'object', properties: {} };
    this._outputSchema = options.outputSchema ?? DEFAULT_TOOL_OUTPUT;
    this._tags = options.tags;
    this._extraMetadata = options.metadata;
  }

  get name(): string {
    return this._name;
  }

  get metadata(): ToolMetadata {
    const result: ToolMetadata = {
      description: this._description,
      input: this._inputSchema,
      output: this._outputSchema,
    };
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

/** Options for creating a tool */
export interface ToolOptions {
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema for input */
  input: JSONSchema;
  /** Optional JSON Schema for output (defaults to string) */
  output?: JSONSchema;
  /** Optional list of tags for categorization */
  tags?: string[];
  /** Optional extra metadata */
  metadata?: Record<string, unknown>;
  /** Handler function to execute when the tool is called */
  handler: ToolHandler;
}

// === tool() factory ===

/**
 * Factory function to create a tool.
 *
 * @example
 * ```typescript
 * import { tool } from '@reminix/runtime';
 *
 * const getWeather = tool('get_weather', {
 *   description: 'Get current weather for a location',
 *   input: {
 *     type: 'object',
 *     properties: {
 *       location: { type: 'string', description: 'City name' },
 *       units: { type: 'string', default: 'celsius' },
 *     },
 *     required: ['location'],
 *   },
 *   output: {
 *     type: 'object',
 *     properties: {
 *       temp: { type: 'number' },
 *       condition: { type: 'string' },
 *     },
 *   },
 *   handler: async (input) => {
 *     const location = input.location as string;
 *     return { temp: 22, condition: 'sunny' };
 *   },
 * });
 * ```
 */
export function tool(name: string, options: ToolOptions): Tool {
  return new _FunctionTool(name, {
    description: options.description,
    inputSchema: options.input,
    outputSchema: options.output,
    tags: options.tags,
    metadata: options.metadata,
    handler: options.handler,
  });
}

// === _FunctionTool (private) ===

class _FunctionTool extends Tool {
  private _handler: ToolHandler;

  constructor(
    name: string,
    options: {
      description: string;
      inputSchema: JSONSchema;
      outputSchema?: JSONSchema;
      tags?: string[];
      metadata?: Record<string, unknown>;
      handler: ToolHandler;
    }
  ) {
    super(name, {
      description: options.description,
      inputSchema: options.inputSchema,
      outputSchema: options.outputSchema,
      tags: options.tags,
      metadata: options.metadata,
    });
    this._handler = options.handler;
  }

  async call(request: ToolRequest): Promise<ToolResponse> {
    const result = await this._handler(request.input, request.context);
    return { output: result };
  }
}
