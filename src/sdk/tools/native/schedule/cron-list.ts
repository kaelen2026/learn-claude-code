import type { ToolDefinition } from '../../../shared/types.js';
import { formatSchedule, type ScheduleManager } from '../../../capabilities/scheduling/schedule-manager.js';

export function createCronListTool(manager: ScheduleManager): ToolDefinition {
  return {
    name: 'cron_list',
    description: '列出所有定时调度任务',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const schedules = await manager.list();
      if (schedules.length === 0) return '当前没有定时调度任务';
      return `定时调度 (${schedules.length} 个):\n${schedules.map(formatSchedule).join('\n---\n')}`;
    },
  };
}
