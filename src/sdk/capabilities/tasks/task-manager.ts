import type { TaskRecord, TaskStatus } from '../../shared/types.js';
import type { TaskStore } from '../../stores/tasks/task-store.js';
import { addTaskDependencies, unlockTaskDependents } from './dependency-graph.js';
import { isTaskReady } from './ready-rule.js';

export class TaskManager {
  private nextId = 1;

  constructor(private readonly store: TaskStore) {}

  async init(): Promise<void> {
    const tasks = await this.store.loadAll();
    if (tasks.length > 0) {
      this.nextId = Math.max(...tasks.map((task) => task.id)) + 1;
    }
  }

  async create(subject: string, description = ''): Promise<TaskRecord> {
    const task: TaskRecord = {
      id: this.nextId++,
      subject,
      description,
      status: 'pending',
      blockedBy: [],
      blocks: [],
      owner: '',
    };
    await this.store.save(task);
    return task;
  }

  async get(id: number): Promise<TaskRecord | null> {
    return this.store.get(id);
  }

  async list(): Promise<TaskRecord[]> {
    const tasks = await this.store.loadAll();
    return tasks.filter((task) => task.status !== 'deleted');
  }

  async update(
    id: number,
    updates: Partial<Pick<TaskRecord, 'status' | 'owner' | 'description' | 'subject'>>,
  ): Promise<TaskRecord | null> {
    const task = await this.store.get(id);
    if (!task) return null;

    if (updates.status) task.status = updates.status;
    if (updates.owner !== undefined) task.owner = updates.owner;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.subject !== undefined) task.subject = updates.subject;

    await this.store.save(task);

    if (updates.status === 'completed') {
      await unlockTaskDependents(this.store, task);
    }

    return task;
  }

  async addBlockedBy(id: number, blockerIds: number[]): Promise<TaskRecord | null> {
    const task = await this.store.get(id);
    if (!task) return null;
    return addTaskDependencies(this.store, task, blockerIds);
  }

  isReady(task: TaskRecord): boolean {
    return isTaskReady(task);
  }

  async getReadyTasks(): Promise<TaskRecord[]> {
    const tasks = await this.list();
    return tasks.filter((task) => this.isReady(task));
  }
}

export function formatTask(task: TaskRecord, manager: Pick<TaskManager, 'isReady'>): string {
  const ready = manager.isReady(task) ? ' 🟢 READY' : '';
  const lines = [
    `${statusIcon(task.status)} #${task.id} ${task.subject}${ready}`,
    `   状态: ${task.status}`,
  ];

  if (task.description) lines.push(`   描述: ${task.description}`);
  if (task.owner) lines.push(`   负责人: ${task.owner}`);
  if (task.blockedBy.length > 0) lines.push(`   被阻塞: [${task.blockedBy.join(', ')}]`);
  if (task.blocks.length > 0) lines.push(`   阻塞: [${task.blocks.join(', ')}]`);

  return lines.join('\n');
}

function statusIcon(status: TaskStatus): string {
  return {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
    deleted: '🗑️',
  }[status];
}
