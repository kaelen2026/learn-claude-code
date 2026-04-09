import type { BackgroundManager } from '../../../capabilities/background/background-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createBackgroundRunTool(manager: BackgroundManager): ToolDefinition {
  return {
    name: 'background_run',
    description: '在后台启动一个慢命令，立刻返回任务 ID',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
      },
      required: ['command'],
    },
    execute: async (input) => {
      const command = String(input.command);
      const id = await manager.run(command);
      return `后台任务已启动: ${id}\n命令: ${command}\n任务将在后台执行，完成后会回流到通知队列。`;
    },
  };
}
