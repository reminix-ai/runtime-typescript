/**
 * Agent for Reminix Runtime.
 */

import type { AgentRequest, AgentResponse, JSONSchema, Capabilities } from './types.js';
import {
  AGENT_TYPES,
  DEFAULT_AGENT_INPUT,
  DEFAULT_AGENT_OUTPUT,
  DEFAULT_AGENT_TYPE,
} from './schemas.js';
import type { AgentType } from './schemas.js';

// Re-export AgentType for convenience
export type { AgentType };

// === AgentMetadata ===

/**
 * Metadata returned by agents for discovery.
 */
export interface AgentMetadata {
  description?: string;
  capabilities: Capabilities;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  /** Named type (prompt, chat, task, rag, thread, workflow) when agent uses a type. */
  type?: AgentType;
  [key: string]: unknown;
}

// === Agent Base Class ===

/**
 * Abstract base class for all agents.
 *
 * Framework agents extend this class. The agent() factory creates
 * a private _FunctionAgent subclass internally.
 */
export abstract class Agent {
  private _name: string;
  private _description: string;
  private _streaming: boolean;
  private _inputSchema: JSONSchema;
  private _outputSchema: JSONSchema;
  private _type: AgentType | undefined;
  private _framework: string | undefined;
  public instructions: string | undefined;
  private _tags: string[] | undefined;
  private _extraMetadata: Record<string, unknown> | undefined;

  constructor(
    name: string,
    options: {
      description?: string;
      streaming?: boolean;
      inputSchema?: JSONSchema;
      outputSchema?: JSONSchema;
      type?: AgentType;
      framework?: string;
      instructions?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    this._name = name;
    this._description = options.description ?? '';
    this._streaming = options.streaming ?? false;
    this._inputSchema = options.inputSchema ?? DEFAULT_AGENT_INPUT;
    this._outputSchema = options.outputSchema ?? DEFAULT_AGENT_OUTPUT;
    this._type = options.type;
    this._framework = options.framework;
    this.instructions = options.instructions;
    this._tags = options.tags;
    this._extraMetadata = options.metadata;
  }

  get name(): string {
    return this._name;
  }

  get metadata(): AgentMetadata {
    const result: AgentMetadata = {
      description: this._description,
      capabilities: { streaming: this._streaming },
      inputSchema: this._inputSchema,
      outputSchema: this._outputSchema,
    };
    if (this._type) {
      result.type = this._type;
    }
    if (this._framework) {
      result.framework = this._framework;
    }
    if (this._tags) {
      result.tags = this._tags;
    }
    if (this._extraMetadata) {
      Object.assign(result, this._extraMetadata);
    }
    return result;
  }

  abstract invoke(request: AgentRequest): Promise<AgentResponse>;

  invokeStream?(request: AgentRequest): AsyncIterable<string>;
}

// === Agent Options ===

/**
 * Options for creating an agent with the agent() factory.
 */
export interface AgentOptions {
  /** Human-readable description of what the agent does */
  description?: string;
  /**
   * Named type (prompt, chat, task, rag, thread, workflow). When set, inputSchema/outputSchema default to the type's schemas
   * unless overridden by explicit inputSchema/outputSchema.
   */
  type?: AgentType;
  /**
   * JSON Schema for input.
   * Defaults to type schema if type is set, else { prompt: string }.
   */
  inputSchema?: JSONSchema;
  /** JSON Schema for output. Defaults to type schema if set, else string. */
  outputSchema?: JSONSchema;
  /**
   * Set to true if handler is an async generator for streaming.
   * When true, non-streaming requests collect all chunks into a single response.
   */
  stream?: boolean;
  /** Optional list of tags for categorization. */
  tags?: string[];
  /** Optional extra metadata to include in the agent's metadata. */
  metadata?: Record<string, unknown>;
  /**
   * Handler function - can be a regular async function or an async generator for streaming.
   *
   * Regular function: Returns output directly
   * Async generator (when stream: true): Yields string chunks
   */
  handler:
    | ((input: Record<string, unknown>, context?: Record<string, unknown>) => Promise<unknown>)
    | ((
        input: Record<string, unknown>,
        context?: Record<string, unknown>
      ) => AsyncGenerator<string, void, unknown>);
}

// === agent() factory ===

/**
 * Create an agent from a configuration object.
 *
 * By default, agents expect `{ input: { prompt: string } }` in the request body and
 * return `{ output: string }`. You can customize by providing `inputSchema`.
 *
 * @example
 * ```typescript
 * // Simple agent with default input/output
 * const echo = agent('echo', {
 *   description: 'Echo the prompt',
 *   handler: async ({ prompt }) => `You said: ${prompt}`,
 * });
 *
 * // Agent with custom input schema
 * const calculator = agent('calculator', {
 *   description: 'Add two numbers',
 *   inputSchema: {
 *     type: 'object',
 *     properties: { a: { type: 'number' }, b: { type: 'number' } },
 *     required: ['a', 'b'],
 *   },
 *   outputSchema: { type: 'number' },
 *   handler: async ({ a, b }) => (a as number) + (b as number),
 * });
 *
 * // Streaming agent (async generator)
 * const streamer = agent('streamer', {
 *   description: 'Stream text word by word',
 *   stream: true,
 *   handler: async function* ({ prompt }) {
 *     for (const word of (prompt as string).split(' ')) {
 *       yield word + ' ';
 *     }
 *   },
 * });
 * ```
 */
export function agent(name: string, options: AgentOptions): Agent {
  const isStreaming = options.stream === true;

  // Default type is 'prompt' when no type and no custom inputSchema/outputSchema
  const effectiveType: AgentType | undefined =
    options.type ??
    (options.inputSchema === undefined && options.outputSchema === undefined
      ? DEFAULT_AGENT_TYPE
      : undefined);

  const inputSchema =
    options.inputSchema ??
    (effectiveType ? AGENT_TYPES[effectiveType].inputSchema : DEFAULT_AGENT_INPUT);
  const outputSchema =
    options.outputSchema ??
    (effectiveType ? AGENT_TYPES[effectiveType].outputSchema : DEFAULT_AGENT_OUTPUT);

  if (isStreaming) {
    const streamFn = options.handler as (
      input: Record<string, unknown>,
      context?: Record<string, unknown>
    ) => AsyncGenerator<string, void, unknown>;

    return new _FunctionAgent(name, {
      description: options.description,
      streaming: true,
      inputSchema,
      outputSchema,
      type: effectiveType,
      tags: options.tags,
      metadata: options.metadata,
      invokeFn: async (request: AgentRequest): Promise<AgentResponse> => {
        const chunks: string[] = [];
        for await (const chunk of streamFn(request.input, request.context)) {
          chunks.push(chunk);
        }
        return { output: chunks.join('') };
      },
      invokeStreamFn: async function* (
        request: AgentRequest
      ): AsyncGenerator<string, void, unknown> {
        yield* streamFn(request.input, request.context);
      },
    });
  }

  const regularHandler = options.handler as (
    input: Record<string, unknown>,
    context?: Record<string, unknown>
  ) => Promise<unknown>;

  return new _FunctionAgent(name, {
    description: options.description,
    streaming: false,
    inputSchema,
    outputSchema,
    type: effectiveType,
    tags: options.tags,
    metadata: options.metadata,
    invokeFn: async (request: AgentRequest): Promise<AgentResponse> => {
      const result = await regularHandler(request.input, request.context);
      return { output: result };
    },
  });
}

// === _FunctionAgent (private) ===

class _FunctionAgent extends Agent {
  private _invokeFn: (request: AgentRequest) => Promise<AgentResponse>;
  private _invokeStreamFn?: (request: AgentRequest) => AsyncGenerator<string, void, unknown>;

  constructor(
    name: string,
    options: {
      description?: string;
      streaming: boolean;
      inputSchema: JSONSchema;
      outputSchema: JSONSchema;
      type?: AgentType;
      tags?: string[];
      metadata?: Record<string, unknown>;
      invokeFn: (request: AgentRequest) => Promise<AgentResponse>;
      invokeStreamFn?: (request: AgentRequest) => AsyncGenerator<string, void, unknown>;
    }
  ) {
    super(name, {
      description: options.description,
      streaming: options.streaming,
      inputSchema: options.inputSchema,
      outputSchema: options.outputSchema,
      type: options.type,
      tags: options.tags,
      metadata: options.metadata,
    });
    this._invokeFn = options.invokeFn;
    this._invokeStreamFn = options.invokeStreamFn;
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    return this._invokeFn(request);
  }

  async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
    if (!this._invokeStreamFn) {
      throw new Error(`Streaming not supported for agent '${this.name}'`);
    }
    yield* this._invokeStreamFn(request);
  }
}
