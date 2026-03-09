/**
 * Reminix Runtime Types
 */

/** Valid message roles. */
export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/** Content part: text */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/** Content part: image URL (optional detail). */
export interface ImageUrlContentPart {
  type: 'image_url';
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' };
}

/** Content part: input audio */
export interface InputAudioContentPart {
  type: 'input_audio';
  input_audio: { data: string; format: 'wav' | 'mp3' };
}

/** Content part: file */
export interface FileContentPart {
  type: 'file';
  file: { file_id?: string; filename?: string; file_data?: string };
}

/** Content part: refusal (assistant) */
export interface RefusalContentPart {
  type: 'refusal';
  refusal: string;
}

/** Message content part (discriminated by type). */
export type ContentPart =
  | TextContentPart
  | ImageUrlContentPart
  | InputAudioContentPart
  | FileContentPart
  | RefusalContentPart;

export interface Message {
  role: Role;
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// === Agent Request/Response ===

/** Request type for agent invoke operations. */
export interface AgentRequest {
  input: Record<string, unknown>;
  stream?: boolean;
  context?: Record<string, unknown>;
}

/** Response type for agent invoke operations. */
export interface AgentResponse {
  output: unknown;
  metadata?: Record<string, unknown>;
}

// === Tool Request/Response ===

/** Request type for tool call operations. */
export interface ToolRequest {
  arguments: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/** Response type for tool call operations. */
export interface ToolResponse {
  output: unknown;
}

// === Schema Types ===

export interface JSONSchema {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null';
  oneOf?: unknown[];
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
  [key: string]: unknown;
}

// === Error Types ===

/**
 * Structured runtime error information
 */
export interface RuntimeErrorInfo {
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
  error: RuntimeErrorInfo;
}
