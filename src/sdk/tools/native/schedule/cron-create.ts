import type { ToolDefinition } from '../../../shared/types.js';
import { formatSchedule, type ScheduleManager } from '../../../capabilities/scheduling/schedule-manager.js';

export function createCronCreateTool(manager: ScheduleManager): ToolDefinition {
  return {
    name: 'cron_create',
    description: '创建一个定时调度任务，使用 5 字段 cron 表达式',
    inputSchema: {
      type: 'object',
      properties: {
        cron: { type: 'string', description: 'Cron 表达式' },
        prompt: { type: 'string', description: '到期时注入的提示' },
        recurring: { type: 'boolean', description: '是否重复执行，默认 true' },
      },
      required: ['cron', 'prompt'],
    },
    execute: async (input) => {
      const record = await manager.create(
        String(input.cron),
        String(input.prompt),
        input.recurring === undefined ? true : Boolean(input.recurring)
      );
      return `调度创建成功:\n${formatSchedule(record)}`;
    },
  };
}
