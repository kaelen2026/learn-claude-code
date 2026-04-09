import type { ToolDefinition } from '../../../shared/types.js';
import type { WorktreeManager } from '../../../capabilities/worktrees/worktree-manager.js';

export function createEnterWorktreeTool(manager: WorktreeManager): ToolDefinition {
  return {
    name: 'enter_worktree',
    description: '进入一个活动工作树',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '工作树名称' },
      },
      required: ['name'],
    },
    execute: async (input) => {
      const record = await manager.enter(String(input.name));
      return record ? `已进入工作树: ${record.name}` : `工作树 ${String(input.name)} 不存在或不可进入`;
    },
  };
}
