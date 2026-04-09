import type { ToolDefinition } from '../../../shared/types.js';
import { formatTask, type TaskManager } from '../../../capabilities/tasks/task-manager.js';

export function createTaskGetTool(manager: TaskManager): ToolDefinition {
  return {
    name: 'task_get',
    description: '查询单个任务的详细信息',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '任务 ID' },
      },
      required: ['id'],
    },
    execute: async (input) => {
      const id = Number(input.id);
      const task = await manager.get(id);
      if (!task) return `错误: 任务 #${id} 不存在`;
      return formatTask(task, manager);
    },
  };
}
