import type { ScheduleManager } from './schedule-manager.js';

export async function runScheduleCheck(manager: ScheduleManager): Promise<void> {
  await manager.check();
}
