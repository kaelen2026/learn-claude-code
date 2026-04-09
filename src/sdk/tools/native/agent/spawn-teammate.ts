import type { TeamManager } from '../../../capabilities/subagents/team-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createSpawnTeammateTool(manager: TeamManager): ToolDefinition {
  return {
    name: 'spawn_teammate',
    description: '创建一个持久团队成员',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '成员名' },
        role: { type: 'string', description: '角色' },
      },
      required: ['name', 'role'],
    },
    execute: async (input) => {
      const member = await manager.spawn(String(input.name), String(input.role));
      return `团队成员已创建: ${member.name} (${member.role})`;
    },
  };
}
