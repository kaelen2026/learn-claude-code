import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { WorktreeRecord } from './worktree-record.js';

export class WorktreeStore {
  constructor(private readonly worktreesDir: string) {}

  private get recordsFile(): string {
    return join(this.worktreesDir, 'worktrees.json');
  }

  async loadAll(): Promise<WorktreeRecord[]> {
    if (!existsSync(this.recordsFile)) return [];
    const raw = await readFile(this.recordsFile, 'utf-8');
    return JSON.parse(raw) as WorktreeRecord[];
  }

  async saveAll(records: WorktreeRecord[]): Promise<void> {
    await writeFile(this.recordsFile, JSON.stringify(records, null, 2), 'utf-8');
  }
}
