import type { TaskManager } from '../../../capabilities/tasks/task-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createTaskCreateTool(manager: TaskManager): ToolDefinition {
  return {
    name: 'task_create',
    description: '创建一个新任务，可选附带描述',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: '任务标题' },
        description: { type: 'string', description: '补充说明' },
      },
      required: ['subject'],
    },
    execute: async (input) => {
      const task = await manager.create(
        String(input.subject),
        input.description ? String(input.description) : '',
      );
      return `任务创建成功: #${task.id} "${task.subject}"`;
    },
  };
}
