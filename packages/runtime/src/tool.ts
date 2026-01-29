/**
 * Reminix Runtime Tool definitions
 */

import type { ToolSchema, ToolExecuteRequest, ToolExecuteResponse } from './types.js';

/** Metadata for a tool */
export interface ToolMetadata {
  type: 'tool';
  description: string;
  parameters: ToolSchema;
  output?: ToolSchema;
}

/** Execute handler function type */
export type ExecuteHandler = (
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

  /** JSON Schema for input parameters */
  abstract get parameters(): ToolSchema;

  /** Optional JSON Schema for output */
  get output(): ToolSchema | undefined {
    return undefined;
  }

  /** Metadata for runtime discovery */
  get metadata(): ToolMetadata {
    const meta: ToolMetadata = {
      type: 'tool',
      description: this.description,
      parameters: this.parameters,
    };
    if (this.output) {
      meta.output = this.output;
    }
    return meta;
  }

  /** Execute the tool with the given input */
  abstract execute(request: ToolExecuteRequest): Promise<ToolExecuteResponse>;
}

/** Options for creating a tool */
export interface ToolOptions {
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema for input parameters */
  parameters: ToolSchema;
  /** Optional JSON Schema for output (for documentation and type inference) */
  output?: ToolSchema;
  /** Handler function to execute when the tool is called */
  handler: ExecuteHandler;
}

/**
 * A tool created using the tool() factory function.
 */
export class Tool extends ToolBase {
  private _name: string;
  private _description: string;
  private _parameters: ToolSchema;
  private _output?: ToolSchema;
  private _executeHandler: ExecuteHandler;

  constructor(name: string, options: ToolOptions) {
    super();
    this._name = name;
    this._description = options.description;
    this._parameters = options.parameters;
    this._output = options.output;
    this._executeHandler = options.handler;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get parameters(): ToolSchema {
    return this._parameters;
  }

  get output(): ToolSchema | undefined {
    return this._output;
  }

  async execute(request: ToolExecuteRequest): Promise<ToolExecuteResponse> {
    try {
      const result = await this._executeHandler(request.input, request.context);
      return { output: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { output: null, error: message };
    }
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
 *   parameters: {
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
