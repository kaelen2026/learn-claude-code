import type { WorktreeManager } from '../../../capabilities/worktrees/worktree-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createRunInWorktreeTool(manager: WorktreeManager): ToolDefinition {
  return {
    name: 'run_in_worktree',
    description: '在指定工作树中执行命令（模拟 cwd 切换）',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '工作树名称' },
        command: { type: 'string', description: '命令' },
      },
      required: ['name', 'command'],
    },
    execute: async (input) => manager.run(String(input.name), String(input.command)),
  };
}
