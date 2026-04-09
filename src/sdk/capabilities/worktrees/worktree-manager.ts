import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { WorktreeRecord } from '../../shared/types.js';
import { WorktreeStore } from '../../stores/worktrees/worktree-store.js';
import { applyCloseout } from './closeout-policy.js';
import { routeCommandToWorktree } from './workspace-router.js';

export class WorktreeManager {
  constructor(
    private readonly store: WorktreeStore,
    private readonly baseDir: string
  ) {}

  async create(name: string, taskId: number | null): Promise<WorktreeRecord> {
    const records = await this.store.loadAll();
    const existing = records.find((record) => record.name === name);
    if (existing) return existing;

    const path = join(this.baseDir, name);
    if (!existsSync(path)) {
      await mkdir(path, { recursive: true });
    }

    const record: WorktreeRecord = {
      name,
      path,
      branch: `worktree/${name}`,
      taskId,
      status: 'active',
      lastEnteredAt: null,
      lastCommandAt: null,
      closeout: null,
    };

    records.push(record);
    await this.store.saveAll(records);
    return record;
  }

  async list(): Promise<WorktreeRecord[]> {
    return this.store.loadAll();
  }

  async enter(name: string): Promise<WorktreeRecord | null> {
    const records = await this.store.loadAll();
    const record = records.find((item) => item.name === name);
    if (!record || record.status !== 'active') return null;
    record.lastEnteredAt = Date.now();
    await this.store.saveAll(records);
    return record;
  }

  async run(name: string, command: string): Promise<string> {
    const records = await this.store.loadAll();
    const record = records.find((item) => item.name === name);
    if (!record) return `工作树 ${name} 不存在`;
    record.lastCommandAt = Date.now();
    await this.store.saveAll(records);
    return routeCommandToWorktree(record, command);
  }

  async closeout(name: string, action: 'keep' | 'remove', reason: string): Promise<string> {
    const records = await this.store.loadAll();
    const index = records.findIndex((item) => item.name === name);
    if (index < 0) return `工作树 ${name} 不存在`;
    records[index] = applyCloseout(records[index], action, reason);
    await this.store.saveAll(records);
    return `工作树 ${name} 已${action === 'keep' ? '保留' : '移除'}: ${reason}`;
  }
}
