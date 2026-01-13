/**
 * Reminix Runtime Types
 */

/** Valid message roles */
export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  role: Role;
  content: string;
}

export interface InvokeRequest {
  messages: Message[];
  context?: Record<string, unknown>;
}

export interface InvokeResponse {
  content: string;
  messages: Message[];
}

export interface ChatRequest {
  messages: Message[];
  context?: Record<string, unknown>;
}

export interface ChatResponse {
  content: string;
  messages: Message[];
}
