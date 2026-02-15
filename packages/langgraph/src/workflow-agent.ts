/**
 * LangGraph workflow agent for Reminix Runtime.
 */

import {
  AGENT_TEMPLATES,
  type AgentRequest,
  type AgentResponse,
  type AgentMetadata,
} from '@reminix/runtime';

interface LangGraphStreamable {
  stream(
    input: unknown,
    config?: Record<string, unknown>
  ): AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>;
}

interface GraphInterruptError extends Error {
  interrupts: Array<{ value: unknown; id?: string }>;
}

function isGraphInterrupt(error: unknown): error is GraphInterruptError {
  if (!(error instanceof Error)) return false;
  if (!('interrupts' in error) || !Array.isArray((error as Record<string, unknown>).interrupts))
    return false;
  // Check constructor name or error name for GraphInterrupt
  return error.constructor?.name === 'GraphInterrupt' || error.name === 'GraphInterrupt';
}

interface WorkflowStep {
  name: string;
  status: 'completed' | 'failed' | 'paused' | 'skipped' | 'pending';
  output?: unknown;
}

interface PendingAction {
  step: string;
  type: string;
  message: string;
  options?: string[];
}

interface WorkflowOutput {
  status: 'completed' | 'failed' | 'paused' | 'running';
  steps: WorkflowStep[];
  result?: unknown;
  pendingAction?: PendingAction;
  error?: string;
}

export class LangGraphWorkflowAgent {
  private graph: LangGraphStreamable;
  private _name: string;

  constructor(graph: LangGraphStreamable, name: string = 'langgraph-workflow-agent') {
    this.graph = graph;
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get metadata(): AgentMetadata {
    return {
      description: 'langgraph workflow agent',
      capabilities: { streaming: false },
      input: AGENT_TEMPLATES['workflow'].input,
      output: AGENT_TEMPLATES['workflow'].output,
      adapter: 'langgraph',
      template: 'workflow',
    };
  }

  async invoke(request: AgentRequest): Promise<AgentResponse> {
    // 1. Extract thread_id from request.context for checkpointed graphs
    const config: Record<string, unknown> = {};
    if (request.context && 'thread_id' in request.context) {
      config.configurable = { thread_id: request.context.thread_id };
    }

    // 2. Determine input: resume vs normal
    let graphInput: unknown;
    const input = request.input as Record<string, unknown>;
    if ('resume' in input && input.resume != null) {
      const resumeData = input.resume as Record<string, unknown>;
      // Dynamic import to avoid hard dependency at module level
      const { Command } = await import('@langchain/langgraph');
      graphInput = new Command({ resume: resumeData.input });
    } else {
      graphInput = request.input;
    }

    // 3. Stream graph and collect steps
    const steps: WorkflowStep[] = [];
    let lastNode: string | undefined;

    try {
      const streamResult = this.graph.stream(graphInput, config);
      const stream = streamResult instanceof Promise ? await streamResult : streamResult;
      for await (const chunk of stream) {
        if (chunk && typeof chunk === 'object') {
          for (const [nodeName, nodeOutput] of Object.entries(chunk as Record<string, unknown>)) {
            lastNode = nodeName;
            steps.push({
              name: nodeName,
              status: 'completed',
              output: nodeOutput,
            });
          }
        }
      }
    } catch (error: unknown) {
      if (isGraphInterrupt(error)) {
        // 4. Handle interrupts
        const interrupt = error.interrupts[0];
        const interruptValue = interrupt?.value;

        let pendingAction: PendingAction;
        if (
          interruptValue &&
          typeof interruptValue === 'object' &&
          'type' in interruptValue &&
          'message' in interruptValue
        ) {
          const iv = interruptValue as Record<string, unknown>;
          pendingAction = {
            step: (iv.step as string) ?? lastNode ?? 'unknown',
            type: iv.type as string,
            message: iv.message as string,
          };
          if ('options' in iv && Array.isArray(iv.options)) {
            pendingAction.options = iv.options as string[];
          }
        } else if (typeof interruptValue === 'string') {
          pendingAction = {
            step: lastNode ?? 'unknown',
            type: 'input',
            message: interruptValue,
          };
        } else {
          pendingAction = {
            step: lastNode ?? 'unknown',
            type: 'input',
            message: String(interruptValue),
          };
        }

        // Mark last step as paused
        if (steps.length > 0) {
          steps[steps.length - 1].status = 'paused';
        }

        const output: WorkflowOutput = {
          status: 'paused',
          steps,
          pendingAction,
        };

        return { output };
      }

      // 5. Handle errors
      if (steps.length > 0) {
        steps[steps.length - 1].status = 'failed';
      }

      const output: WorkflowOutput = {
        status: 'failed',
        steps,
        error: error instanceof Error ? error.message : String(error),
      };

      return { output };
    }

    // 6. Normal completion
    const result = steps.length > 0 ? steps[steps.length - 1].output : undefined;

    const output: WorkflowOutput = {
      status: 'completed',
      steps,
    };
    if (result !== undefined) {
      output.result = result;
    }

    return { output };
  }
}
