/**
 * Agent for Reminix Runtime.
 */

import type { AgentRequest, AgentResponse, JSONSchema, Capabilities } from './types.js';
import {
  AGENT_TEMPLATES,
  DEFAULT_AGENT_INPUT,
  DEFAULT_AGENT_OUTPUT,
  DEFAULT_AGENT_TEMPLATE,
} from './schemas.js';
import type { AgentTemplate } from './schemas.js';

// Re-export AgentTemplate for convenience
export type { AgentTemplate };

// === AgentLike Interface ===

/**
 * Metadata returned by agents for discovery.
 */
export interface AgentMetadata {
  description?: string;
  capabilities: Capabilities;
  input: JSONSchema;
  output?: JSONSchema;
  /** Named template (prompt, chat, task, rag, thread, workflow) when agent uses a template. */
  template?: AgentTemplate;
  [key: string]: unknown;
}

/**
 * Interface defining what the server accepts as an agent.
 *
 * Both the agent() factory and framework agents produce objects
 * conforming to this interface.
 */
export interface AgentLike {
  readonly name: string;
  readonly metadata: AgentMetadata;
  invoke(request: AgentRequest): Promise<AgentResponse>;
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
   * Named template (prompt, chat, task, rag, thread, workflow). When set, input/output default to the template's schemas
   * unless overridden by explicit input/output.
   */
  template?: AgentTemplate;
  /**
   * JSON Schema for input.
   * Defaults to template schema if template is set, else { prompt: string }.
   */
  input?: JSONSchema;
  /** JSON Schema for output. Defaults to template schema if set, else string. */
  output?: JSONSchema;
  /**
   * Set to true if handler is an async generator for streaming.
   * When true, non-streaming requests collect all chunks into a single response.
   */
  stream?: boolean;
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
 * return `{ output: string }`. You can customize by providing `input` schema.
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
 *   input: {
 *     type: 'object',
 *     properties: { a: { type: 'number' }, b: { type: 'number' } },
 *     required: ['a', 'b'],
 *   },
 *   output: { type: 'number' },
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
export function agent(name: string, options: AgentOptions): AgentLike {
  const isStreaming = options.stream === true;

  // Default template is 'prompt' when no template and no custom input/output
  const effectiveTemplate: AgentTemplate | undefined =
    options.template ??
    (options.input === undefined && options.output === undefined
      ? DEFAULT_AGENT_TEMPLATE
      : undefined);

  const inputSchema =
    options.input ??
    (effectiveTemplate ? AGENT_TEMPLATES[effectiveTemplate].input : DEFAULT_AGENT_INPUT);
  const outputSchema =
    options.output ??
    (effectiveTemplate ? AGENT_TEMPLATES[effectiveTemplate].output : DEFAULT_AGENT_OUTPUT);

  const metadata: AgentMetadata = {
    description: options.description,
    capabilities: { streaming: isStreaming },
    input: inputSchema,
    output: outputSchema,
    ...(effectiveTemplate !== undefined && { template: effectiveTemplate }),
  };

  if (isStreaming) {
    const streamFn = options.handler as (
      input: Record<string, unknown>,
      context?: Record<string, unknown>
    ) => AsyncGenerator<string, void, unknown>;

    return {
      name,
      metadata,
      async invoke(request: AgentRequest): Promise<AgentResponse> {
        const chunks: string[] = [];
        for await (const chunk of streamFn(request.input, request.context)) {
          chunks.push(chunk);
        }
        return { output: chunks.join('') };
      },
      async *invokeStream(request: AgentRequest): AsyncGenerator<string, void, unknown> {
        yield* streamFn(request.input, request.context);
      },
    };
  }

  const regularHandler = options.handler as (
    input: Record<string, unknown>,
    context?: Record<string, unknown>
  ) => Promise<unknown>;

  return {
    name,
    metadata,
    async invoke(request: AgentRequest): Promise<AgentResponse> {
      const result = await regularHandler(request.input, request.context);
      return { output: result };
    },
  };
}
