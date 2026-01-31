/**
 * Reminix Runtime Types
 */

/** Valid message roles */
export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: Role;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ExecuteRequest {
  input: Record<string, unknown>;
  stream?: boolean;
  context?: Record<string, unknown>;
}

/**
 * Response from agent execute.
 * The shape depends on the agent's responseKeys.
 * - Regular agents: { output: unknown }
 * - Chat agents: { messages: Message[] }
 */
export type ExecuteResponse = Record<string, unknown>;

// Tool types

export interface ToolSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolExecuteRequest {
  input: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ToolExecuteResponse {
  output: unknown;
  error?: string | null;
}

/**
 * Structured runtime error information
 */
export interface RuntimeError {
  /** Error type/category (e.g., 'ValidationError', 'ExecutionError') */
  type: string;
  /** Human-readable error message */
  message: string;
  /** Stack trace (only included when REMINIX_CLOUD is enabled) */
  stack?: string;
}

/**
 * Error response from runtime endpoints
 */
export interface RuntimeErrorResponse {
  error: RuntimeError;
}
