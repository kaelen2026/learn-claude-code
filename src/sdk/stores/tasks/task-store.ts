import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { TaskRecord } from './task-record.js';
import { readJsonFile, writeJsonFile } from '../fs/json-store.js';

export class TaskStore {
  constructor(private readonly tasksDir: string) {}

  async loadAll(): Promise<TaskRecord[]> {
    if (!existsSync(this.tasksDir)) return [];

    const files = await readdir(this.tasksDir);
    const tasks: TaskRecord[] = [];

    for (const file of files) {
      if (!file.startsWith('task_') || !file.endsWith('.json')) continue;
      const task = await readJsonFile<TaskRecord | null>(join(this.tasksDir, file), null);
      if (task) tasks.push(task);
    }

    return tasks.sort((a, b) => a.id - b.id);
  }

  async get(id: number): Promise<TaskRecord | null> {
    const filepath = join(this.tasksDir, `task_${id}.json`);
    if (!existsSync(filepath)) return null;
    return readJsonFile<TaskRecord | null>(filepath, null);
  }

  async save(task: TaskRecord): Promise<void> {
    await writeJsonFile(join(this.tasksDir, `task_${task.id}.json`), task);
  }
}
