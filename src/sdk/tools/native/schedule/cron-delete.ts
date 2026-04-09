import type { ScheduleManager } from '../../../capabilities/scheduling/schedule-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createCronDeleteTool(manager: ScheduleManager): ToolDefinition {
  return {
    name: 'cron_delete',
    description: '删除一个定时调度任务',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '调度 ID' },
      },
      required: ['id'],
    },
    execute: async (input) => {
      const id = String(input.id);
      const deleted = await manager.delete(id);
      return deleted ? `调度 ${id} 已删除` : `未找到调度: ${id}`;
    },
  };
}
