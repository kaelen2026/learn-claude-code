import type { CloseoutRecord, WorktreeRecord } from '../../shared/types.js';

export function applyCloseout(
  record: WorktreeRecord,
  action: 'keep' | 'remove',
  reason: string
): WorktreeRecord {
  const closeout: CloseoutRecord = {
    action,
    reason,
    timestamp: Date.now(),
  };

  return {
    ...record,
    status: action === 'keep' ? 'kept' : 'removed',
    closeout,
  };
}
