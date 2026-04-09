import type { ToolDefinition } from '../../../shared/types.js';
import type { TeamManager } from '../../../capabilities/subagents/team-manager.js';

export function createListTeamTool(manager: TeamManager): ToolDefinition {
  return {
    name: 'list_team',
    description: '列出所有团队成员',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const members = await manager.listMembers();
      if (members.length === 0) return '团队为空';
      return members
        .map((member) => `  ${member.status === 'working' ? '🔄' : '💤'} ${member.name} (${member.role}) - ${member.status}`)
        .join('\n');
    },
  };
}
