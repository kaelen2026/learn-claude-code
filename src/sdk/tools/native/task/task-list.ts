import type { ToolDefinition } from '../../../shared/types.js';
import type { TaskManager } from '../../../capabilities/tasks/task-manager.js';

export function createTaskListTool(manager: TaskManager): ToolDefinition {
  return {
    name: 'task_list',
    description: '列出所有任务，显示状态、依赖和就绪情况',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const tasks = await manager.list();
      if (tasks.length === 0) return '当前没有任务';

      const ready = tasks.filter((task) => manager.isReady(task));
      const lines = tasks.map((task) => {
        const readyFlag = manager.isReady(task) ? ' 🟢 READY' : '';
        const blockedInfo =
          task.blockedBy.length > 0 ? ` ⛓️ blocked by: [${task.blockedBy.join(', ')}]` : '';
        const ownerInfo = task.owner ? ` 👤 ${task.owner}` : '';
        return `  ${statusIcon(task.status)} #${task.id} ${task.subject}${ownerInfo}${blockedInfo}${readyFlag}`;
      });

      return `任务列表 (${tasks.length} 个, ${ready.length} 个就绪):\n${lines.join('\n')}`;
    },
  };
}

function statusIcon(status: 'pending' | 'in_progress' | 'completed' | 'deleted'): string {
  return {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
    deleted: '🗑️',
  }[status];
}
