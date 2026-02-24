/**
 * Message conversion utilities between Reminix and LangChain formats.
 */

import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';

import { messageContentToText, type Message } from '@reminix/runtime';

/**
 * Convert a Reminix message to a LangChain message.
 */
export function toLangChainMessage(message: Message): BaseMessage {
  const { role } = message;
  const contentStr = messageContentToText(message.content);

  switch (role) {
    case 'user':
      return new HumanMessage({ content: contentStr });
    case 'assistant': {
      const toolCalls = message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
        type: 'tool_call' as const,
      }));
      return new AIMessage({
        content: contentStr,
        ...(toolCalls && toolCalls.length > 0 && { tool_calls: toolCalls }),
      });
    }
    case 'system':
    case 'developer':
      return new SystemMessage({ content: contentStr });
    case 'tool':
      return new ToolMessage({
        content: contentStr,
        tool_call_id: message.tool_call_id || 'unknown',
      });
    default:
      return new HumanMessage({ content: contentStr });
  }
}

/**
 * Convert a LangChain BaseMessage to a Reminix message.
 */
export function fromLangChainMessage(lcMessage: BaseMessage): Message {
  const type = lcMessage._getType();
  const content =
    typeof lcMessage.content === 'string' ? lcMessage.content : JSON.stringify(lcMessage.content);

  switch (type) {
    case 'human':
      return { role: 'user', content };
    case 'ai': {
      const msg: Message = { role: 'assistant', content };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aiMsg = lcMessage as any;
      if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
        msg.tool_calls = aiMsg.tool_calls.map(
          (tc: { id?: string; name: string; args: Record<string, unknown> }) => ({
            id: tc.id || 'unknown',
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          })
        );
      }
      return msg;
    }
    case 'system':
      return { role: 'system', content };
    case 'tool': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolMsg = lcMessage as any;
      return {
        role: 'tool',
        content,
        tool_call_id: toolMsg.tool_call_id || 'unknown',
      };
    }
    default:
      return { role: 'user', content };
  }
}
