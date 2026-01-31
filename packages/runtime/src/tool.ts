/**
 * Reminix Runtime Tool definitions
 */

import type { ToolCallRequest, ToolCallResponse, JSONSchema, Capabilities } from './types.js';

/**
 * Default output schema for tools.
 * Response: { output: '...' }
 */
const DEFAULT_TOOL_OUTPUT: JSONSchema = {
  type: 'string',
};

/** Metadata for a tool */
export interface ToolMetadata {
  description: string;
  capabilities?: Capabilities;
  input: JSONSchema;
  output?: JSONSchema;
}

/** Handler function type */
export type ToolHandler = (
  input: Record<string, unknown>,
  context?: Record<string, unknown>
) => Promise<unknown> | unknown;

/**
 * Abstract base class for all tools.
 */
export abstract class ToolBase {
  /** Unique tool identifier */
  abstract get name(): string;

  /** Human-readable description */
  abstract get description(): string;

  /** JSON Schema for input */
  abstract get input(): JSONSchema;

  /** Optional JSON Schema for output */
  get output(): JSONSchema | undefined {
    return undefined;
  }

  /** Metadata for runtime discovery */
  get metadata(): ToolMetadata {
    const meta: ToolMetadata = {
      description: this.description,
      input: this.input,
    };
    if (this.output) {
      meta.output = this.output;
    }
    return meta;
  }

  /** Call the tool with the given request */
  abstract call(request: ToolCallRequest): Promise<ToolCallResponse>;
}

/** Options for creating a tool */
export interface ToolOptions {
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema for input */
  input: JSONSchema;
  /** Optional JSON Schema for output (defaults to string) */
  output?: JSONSchema;
  /** Handler function to execute when the tool is called */
  handler: ToolHandler;
}

/**
 * A tool created using the tool() factory function.
 */
export class Tool extends ToolBase {
  private _name: string;
  private _description: string;
  private _input: JSONSchema;
  private _output?: JSONSchema;
  private _handler: ToolHandler;

  constructor(name: string, options: ToolOptions) {
    super();
    this._name = name;
    this._description = options.description;
    this._input = options.input;
    this._output = options.output;
    this._handler = options.handler;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get input(): JSONSchema {
    return this._input;
  }

  get output(): JSONSchema | undefined {
    return this._output ?? DEFAULT_TOOL_OUTPUT;
  }

  /**
   * Call the tool by invoking the handler function.
   *
   * Exceptions are not caught here - they propagate to the server
   * which returns appropriate HTTP error codes.
   */
  async call(request: ToolCallRequest): Promise<ToolCallResponse> {
    const result = await this._handler(request.input, request.context);
    return { output: result };
  }
}

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
  return new Tool(name, options);
}
