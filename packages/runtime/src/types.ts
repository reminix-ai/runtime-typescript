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

export interface InvokeRequest {
  input: Record<string, unknown>;
  stream?: boolean;
  context?: Record<string, unknown>;
}

export interface InvokeResponse {
  output: unknown;
}

export interface ChatRequest {
  messages: Message[];
  stream?: boolean;
  context?: Record<string, unknown>;
}

export interface ChatResponse {
  output: string;
  messages: Message[];
}

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
