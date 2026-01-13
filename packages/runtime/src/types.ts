/**
 * Reminix Runtime Types
 */

export interface Message {
  role: string;
  content: string;
}

export interface InvokeRequest {
  messages: Message[];
}

export interface InvokeResponse {
  content: string;
  messages: Record<string, unknown>[];
}

export interface ChatRequest {
  messages: Message[];
}

export interface ChatResponse {
  content: string;
  messages: Record<string, unknown>[];
}
