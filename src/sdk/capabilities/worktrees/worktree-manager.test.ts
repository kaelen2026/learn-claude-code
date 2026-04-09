import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { WorktreeStore } from '../../stores/worktrees/worktree-store.js';
import { WorktreeManager } from './worktree-manager.js';

function makeManager() {
  const dir = mkdtempSync(join(tmpdir(), 'worktree-manager-'));
  return new WorktreeManager(new WorktreeStore(dir), dir);
}

describe('WorktreeManager', () => {
  it('does not run commands after closeout', async () => {
    const manager = makeManager();
    await manager.create('demo', null);
    await manager.closeout('demo', 'remove', 'done');

    const result = await manager.run('demo', 'pwd');
    expect(result).toContain('不能继续执行命令');
  });

  it('marks routed execution as simulated', async () => {
    const manager = makeManager();
    await manager.create('demo', null);

    const result = await manager.run('demo', 'pwd');
    expect(result).toContain('模拟工作树执行');
    expect(result).toContain('simulated cwd=');
  });
});
