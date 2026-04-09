import type { TaskRecord } from '../../shared/types.js';
import type { TaskStore } from '../../stores/tasks/task-store.js';

export async function addTaskDependencies(
  store: TaskStore,
  task: TaskRecord,
  blockerIds: number[],
): Promise<TaskRecord> {
  for (const blockerId of blockerIds) {
    const blocker = await store.get(blockerId);
    if (!blocker) continue;

    if (!task.blockedBy.includes(blockerId)) {
      task.blockedBy.push(blockerId);
    }

    if (!blocker.blocks.includes(task.id)) {
      blocker.blocks.push(task.id);
      await store.save(blocker);
    }
  }

  await store.save(task);
  return task;
}

export async function unlockTaskDependents(store: TaskStore, task: TaskRecord): Promise<void> {
  for (const dependentId of task.blocks) {
    const dependent = await store.get(dependentId);
    if (!dependent) continue;
    dependent.blockedBy = dependent.blockedBy.filter((id) => id !== task.id);
    await store.save(dependent);
  }
}
