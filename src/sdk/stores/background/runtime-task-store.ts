import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { RuntimeTaskRecord } from './runtime-task-record.js';
import { readJsonFile, writeJsonFile } from '../fs/json-store.js';

export class RuntimeTaskStore {
  constructor(private readonly tasksDir: string) {}

  async loadAll(): Promise<RuntimeTaskRecord[]> {
    if (!existsSync(this.tasksDir)) return [];
    const files = await readdir(this.tasksDir);
    const tasks: RuntimeTaskRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const task = await readJsonFile<RuntimeTaskRecord | null>(join(this.tasksDir, file), null);
      if (task) tasks.push(task);
    }

    return tasks.sort((a, b) => a.startedAt - b.startedAt);
  }

  async get(id: string): Promise<RuntimeTaskRecord | null> {
    const file = join(this.tasksDir, `${id}.json`);
    if (!existsSync(file)) return null;
    return readJsonFile<RuntimeTaskRecord | null>(file, null);
  }

  async save(task: RuntimeTaskRecord): Promise<void> {
    await writeJsonFile(join(this.tasksDir, `${task.id}.json`), task);
  }
}
