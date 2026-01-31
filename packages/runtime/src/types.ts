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

// === Request Types ===

/** Base request type for invoke/call operations */
export interface InvokeRequest {
  input: Record<string, unknown>;
  stream?: boolean;
  context?: Record<string, unknown>;
}

/** Request type for agent invoke operations */
export type AgentInvokeRequest = InvokeRequest;

/** Request type for tool call operations */
export type ToolCallRequest = InvokeRequest;

// === Response Types ===

/** Base response type for invoke/call operations */
export interface InvokeResponse {
  output: unknown;
  metadata?: Record<string, unknown>;
}

/** Response type for agent invoke operations */
export type AgentInvokeResponse = InvokeResponse;

/** Response type for tool call operations */
export type ToolCallResponse = InvokeResponse;

// === Schema Types ===

export interface JSONSchema {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null';
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
  description?: string;
  default?: unknown;
  [key: string]: unknown;
}

// === Capabilities ===

export interface Capabilities {
  streaming?: boolean;
  // batch?: boolean;    // Process multiple inputs in one call
  // async?: boolean;    // Fire-and-forget with webhook callback
  // retry?: boolean;    // Built-in retry with backoff
  [key: string]: unknown;
}

// === Error Types ===

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
