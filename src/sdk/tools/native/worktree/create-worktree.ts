import type { WorktreeManager } from '../../../capabilities/worktrees/worktree-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createCreateWorktreeTool(manager: WorktreeManager): ToolDefinition {
  return {
    name: 'create_worktree',
    description: '创建一个工作树并可选绑定任务',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '工作树名称' },
        task_id: { type: 'number', description: '可选任务 ID' },
      },
      required: ['name'],
    },
    execute: async (input) => {
      const record = await manager.create(
        String(input.name),
        input.task_id === undefined ? null : Number(input.task_id),
      );
      return `工作树已创建: ${record.name} (${record.branch})`;
    },
  };
}
