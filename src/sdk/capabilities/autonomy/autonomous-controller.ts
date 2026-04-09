import type { TaskRecord } from '../../shared/types.js';
import type { TaskManager } from '../tasks/task-manager.js';

export interface AutonomousSuggestion {
  taskId: number;
  subject: string;
  reason: string;
}

export class AutonomousController {
  constructor(private readonly taskManager: TaskManager) {}

  async suggestNextTasks(limit = 3): Promise<AutonomousSuggestion[]> {
    const readyTasks = await this.taskManager.getReadyTasks();
    return readyTasks.slice(0, limit).map((task) => ({
      taskId: task.id,
      subject: task.subject,
      reason: task.owner
        ? `任务已由 ${task.owner} 持有，但仍然就绪`
        : '任务处于 pending 且没有阻塞依赖',
    }));
  }

  async buildRuntimeReminder(): Promise<string | null> {
    const suggestions = await this.suggestNextTasks(2);
    if (suggestions.length === 0) return null;

    return [
      '[自主执行建议]',
      ...suggestions.map(
        (suggestion) => `- #${suggestion.taskId} ${suggestion.subject}: ${suggestion.reason}`,
      ),
    ].join('\n');
  }

  isClaimableTask(task: TaskRecord): boolean {
    return task.status === 'pending' && !task.owner && task.blockedBy.length === 0;
  }
}
