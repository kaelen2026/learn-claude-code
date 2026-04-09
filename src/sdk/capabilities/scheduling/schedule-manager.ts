import type { RuntimeNotification, ScheduleRecord } from '../../shared/types.js';
import type { ScheduleStore } from '../../stores/schedules/schedule-store.js';
import type { NotificationQueue } from '../background/notification-queue.js';
import { matchesCron } from './cron-parser.js';

export class ScheduleManager {
  private nextId = 1;

  constructor(
    private readonly store: ScheduleStore,
    private readonly queue: NotificationQueue,
  ) {}

  async init(): Promise<void> {
    const schedules = await this.store.loadAll();
    if (schedules.length > 0) {
      const ids = schedules
        .map((record) => Number.parseInt(record.id.replace('job_', ''), 10))
        .filter((value) => Number.isFinite(value));
      if (ids.length > 0) {
        this.nextId = Math.max(...ids) + 1;
      }
    }
  }

  async create(cron: string, prompt: string, recurring = true): Promise<ScheduleRecord> {
    const record: ScheduleRecord = {
      id: `job_${String(this.nextId++).padStart(3, '0')}`,
      cron,
      prompt,
      recurring,
      createdAt: Date.now(),
      lastFiredAt: null,
    };
    await this.store.save(record);
    return record;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async list(): Promise<ScheduleRecord[]> {
    return this.store.loadAll();
  }

  async check(now = new Date()): Promise<RuntimeNotification[]> {
    const schedules = await this.store.loadAll();
    const fired: RuntimeNotification[] = [];
    const currentMinute = Math.floor(now.getTime() / 60000);

    for (const record of schedules) {
      if (record.lastFiredAt) {
        const lastMinute = Math.floor(record.lastFiredAt / 60000);
        if (lastMinute === currentMinute) continue;
      }

      if (!matchesCron(record.cron, now)) continue;

      record.lastFiredAt = now.getTime();
      await this.store.save(record);

      const notification: RuntimeNotification = {
        type: 'scheduled_prompt',
        scheduleId: record.id,
        prompt: record.prompt,
      };

      fired.push(notification);
      this.queue.push(notification);

      if (!record.recurring) {
        await this.store.delete(record.id);
      }
    }

    return fired;
  }

  drainNotifications(): RuntimeNotification[] {
    return this.queue.drain();
  }
}

export function formatSchedule(record: ScheduleRecord): string {
  const recurring = record.recurring ? '🔁 重复' : '1️⃣ 一次性';
  const lastFired = record.lastFiredAt
    ? new Date(record.lastFiredAt).toLocaleString('zh-CN')
    : '未触发';

  return [
    `  ⏰ ${record.id} [${record.cron}] ${recurring}`,
    `     任务: ${record.prompt}`,
    `     上次触发: ${lastFired}`,
  ].join('\n');
}
