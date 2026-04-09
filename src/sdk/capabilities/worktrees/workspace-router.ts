import type { WorktreeRecord } from '../../shared/types.js';

export function routeCommandToWorktree(record: WorktreeRecord, command: string): string {
  return `[模拟工作树执行] ${record.path}\n$ ${command}\n(ok, simulated cwd=${record.path})`;
}
