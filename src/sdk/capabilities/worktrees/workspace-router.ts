import type { WorktreeRecord } from '../../shared/types.js';

export function routeCommandToWorktree(record: WorktreeRecord, command: string): string {
  return `[在 ${record.path} 中执行] $ ${command}\n(ok, cwd=${record.path})`;
}
