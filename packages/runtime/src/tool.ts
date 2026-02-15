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

// === ToolLike Interface ===

/** Metadata for a tool */
export interface ToolMetadata {
  description: string;
  input: JSONSchema;
  output: JSONSchema;
}

/** Handler function type */
export type ToolHandler = (
  input: Record<string, unknown>,
  context?: Record<string, unknown>
) => Promise<unknown> | unknown;

/**
 * Interface defining what the server accepts as a tool.
 *
 * Both the tool() factory and adapter wrapTool() produce objects
 * conforming to this interface.
 */
export interface ToolLike {
  readonly name: string;
  readonly metadata: ToolMetadata;
  call(request: ToolRequest): Promise<ToolResponse>;
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
export function tool(name: string, options: ToolOptions): ToolLike {
  const metadata: ToolMetadata = {
    description: options.description,
    input: options.input,
    output: options.output ?? DEFAULT_TOOL_OUTPUT,
  };

  return {
    name,
    metadata,
    async call(request: ToolRequest): Promise<ToolResponse> {
      const result = await options.handler(request.input, request.context);
      return { output: result };
    },
  };
}
