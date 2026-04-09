import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { readJsonFile, writeJsonFile } from '../fs/json-store.js';
import type { ScheduleRecord } from './schedule-record.js';

export class ScheduleStore {
  constructor(private readonly schedulesDir: string) {}

  async loadAll(): Promise<ScheduleRecord[]> {
    if (!existsSync(this.schedulesDir)) return [];
    const files = await readdir(this.schedulesDir);
    const records: ScheduleRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const record = await readJsonFile<ScheduleRecord | null>(join(this.schedulesDir, file), null);
      if (record) records.push(record);
    }

    return records.sort((a, b) => a.createdAt - b.createdAt);
  }

  async get(id: string): Promise<ScheduleRecord | null> {
    const file = join(this.schedulesDir, `${id}.json`);
    if (!existsSync(file)) return null;
    return readJsonFile<ScheduleRecord | null>(file, null);
  }

  async save(record: ScheduleRecord): Promise<void> {
    await writeJsonFile(join(this.schedulesDir, `${record.id}.json`), record);
  }

  async delete(id: string): Promise<boolean> {
    const file = join(this.schedulesDir, `${id}.json`);
    if (!existsSync(file)) return false;
    const { unlink } = await import('fs/promises');
    await unlink(file);
    return true;
  }
}
