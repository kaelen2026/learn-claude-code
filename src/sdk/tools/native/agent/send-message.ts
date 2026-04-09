import type { TeamManager } from '../../../capabilities/subagents/team-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createSendMessageTool(manager: TeamManager): ToolDefinition {
  return {
    name: 'send_message',
    description: '向团队成员发送消息',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '发送者' },
        to: { type: 'string', description: '接收者' },
        content: { type: 'string', description: '消息内容' },
      },
      required: ['from', 'to', 'content'],
    },
    execute: async (input) => {
      await manager.sendMessage(String(input.from), String(input.to), String(input.content));
      return `消息已发送: ${String(input.from)} → ${String(input.to)}`;
    },
  };
}
