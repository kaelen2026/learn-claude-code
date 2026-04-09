import type { ToolDefinition } from '../../../shared/types.js';
import type { WorktreeManager } from '../../../capabilities/worktrees/worktree-manager.js';

export function createCloseoutWorktreeTool(manager: WorktreeManager): ToolDefinition {
  return {
    name: 'closeout_worktree',
    description: '显式收尾工作树，keep 或 remove',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '工作树名称' },
        action: { type: 'string', description: 'keep 或 remove' },
        reason: { type: 'string', description: '收尾原因' },
      },
      required: ['name', 'action', 'reason'],
    },
    execute: async (input) =>
      manager.closeout(
        String(input.name),
        String(input.action) === 'remove' ? 'remove' : 'keep',
        String(input.reason)
      ),
  };
}
