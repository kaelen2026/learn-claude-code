import type { ToolDefinition } from '../../../shared/types.js';
import type { TeamManager } from '../../../capabilities/subagents/team-manager.js';

export function createAssignWorkTool(manager: TeamManager): ToolDefinition {
  return {
    name: 'assign_work',
    description: '分配任务给团队成员并返回结果',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '成员名' },
        task: { type: 'string', description: '任务描述' },
      },
      required: ['name', 'task'],
    },
    execute: async (input) => {
      const result = await manager.runMemberLoop(String(input.name), String(input.task));
      return `${String(input.name)} 的结果:\n${result}`;
    },
  };
}
