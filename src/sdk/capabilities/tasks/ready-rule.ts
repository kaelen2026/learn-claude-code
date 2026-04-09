import type { TaskRecord } from '../../shared/types.js';

export function isTaskReady(task: TaskRecord): boolean {
  return task.status === 'pending' && task.blockedBy.length === 0;
}
