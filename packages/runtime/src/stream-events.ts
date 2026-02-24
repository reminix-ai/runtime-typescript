/**
 * Structured streaming event types for Reminix Runtime.
 *
 * These are the application-level events yielded during streaming.
 * Transport-level concerns (done/error) are handled by the server and SDK.
 */

import type { Message, ToolCall } from './types.js';

/** A text token chunk. */
export interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

/** An assistant tool call. */
export interface ToolCallEvent {
  type: 'tool_call';
  tool_call: ToolCall;
}

/** The result of a tool call. */
export interface ToolResultEvent {
  type: 'tool_result';
  tool_call_id: string;
  output: string;
}

/** A complete message (used by thread/graph agents). */
export interface MessageEvent {
  type: 'message';
  message: Message;
}

/** A workflow step completion (used by workflow agents). */
export interface StepEvent {
  type: 'step';
  name: string;
  status: string;
  output?: unknown;
  pendingAction?: {
    step: string;
    type: string;
    message: string;
    options?: string[];
  };
}

/** Discriminated union of all application-level stream events. */
export type StreamEvent =
  | TextDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | MessageEvent
  | StepEvent;
