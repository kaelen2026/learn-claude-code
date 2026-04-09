import type { TaskStatus, ToolDefinition } from '../../../shared/types.js';
import { formatTask, type TaskManager } from '../../../capabilities/tasks/task-manager.js';

export function createTaskUpdateTool(manager: TaskManager): ToolDefinition {
  return {
    name: 'task_update',
    description: '更新任务状态、负责人、描述，或设置 blockedBy 依赖',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '任务 ID' },
        status: { type: 'string', description: 'pending, in_progress, completed, deleted' },
        owner: { type: 'string', description: '负责人' },
        description: { type: 'string', description: '更新描述' },
        subject: { type: 'string', description: '更新标题' },
        blockedBy: { type: 'array', description: '依赖任务 ID 列表' },
      },
      required: ['id'],
    },
    execute: async (input) => {
      const id = Number(input.id);

      if (Array.isArray(input.blockedBy)) {
        await manager.addBlockedBy(
          id,
          input.blockedBy.map((value) => Number(value))
        );
      }

      const updates: {
        status?: TaskStatus;
        owner?: string;
        description?: string;
        subject?: string;
      } = {};

      if (input.status) updates.status = String(input.status) as TaskStatus;
      if (input.owner !== undefined) updates.owner = String(input.owner);
      if (input.description !== undefined) updates.description = String(input.description);
      if (input.subject !== undefined) updates.subject = String(input.subject);

      if (Object.keys(updates).length > 0) {
        const task = await manager.update(id, updates);
        if (!task) return `错误: 任务 #${id} 不存在`;
        return formatTask(task, manager);
      }

      const task = await manager.get(id);
      if (!task) return `错误: 任务 #${id} 不存在`;
      return formatTask(task, manager);
    },
  };
}
