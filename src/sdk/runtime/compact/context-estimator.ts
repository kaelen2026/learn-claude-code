import type { AgentMessage } from '../../shared/types.js';

export function estimateContextSize(messages: AgentMessage[]): number {
  return messages.reduce((total, message) => {
    const content =
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    return total + content.length;
  }, 0);
}
