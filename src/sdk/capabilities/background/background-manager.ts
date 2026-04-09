import { join } from 'path';
import type { RuntimeNotification, RuntimeTaskRecord, RuntimeTaskStatus } from '../../shared/types.js';
import { RuntimeTaskStore } from '../../stores/background/runtime-task-store.js';
import { NotificationQueue } from './notification-queue.js';
import { previewOutput, writeOutputFile } from './output-capture.js';

export class BackgroundManager {
  private nextId = 1;

  constructor(
    private readonly store: RuntimeTaskStore,
    private readonly outputDir: string,
    private readonly queue: NotificationQueue
  ) {}

  async init(): Promise<void> {
    const tasks = await this.store.loadAll();
    if (tasks.length > 0) {
      const ids = tasks
        .map((task) => Number.parseInt(task.id.replace('bg_', ''), 10))
        .filter((value) => Number.isFinite(value));
      if (ids.length > 0) {
        this.nextId = Math.max(...ids) + 1;
      }
    }
  }

  async run(command: string): Promise<string> {
    const id = `bg_${this.nextId++}`;
    const task: RuntimeTaskRecord = {
      id,
      command,
      status: 'running',
      startedAt: Date.now(),
      resultPreview: '',
      outputFile: '',
    };
    await this.store.save(task);
    this.execute(id, command);
    return id;
  }

  async check(id: string): Promise<RuntimeTaskRecord | null> {
    return this.store.get(id);
  }

  async listAll(): Promise<RuntimeTaskRecord[]> {
    return this.store.loadAll();
  }

  drainNotifications(): RuntimeNotification[] {
    return this.queue.drain();
  }

  private execute(taskId: string, command: string) {
    const duration = 1000 + Math.random() * 2000;

    setTimeout(async () => {
      const task = await this.store.get(taskId);
      if (!task) return;

      const status: RuntimeTaskStatus = 'completed';
      const output = `$ ${command}\n${'='.repeat(40)}\n[模拟] 命令执行完成\n耗时: ${Math.round(duration)}ms\n退出码: 0\n${'='.repeat(40)}`;
      const outputFile = join(this.outputDir, `${taskId}.txt`);
      await writeOutputFile(outputFile, output);

      task.status = status;
      task.resultPreview = previewOutput(output);
      task.outputFile = outputFile;
      await this.store.save(task);

      this.queue.push({
        type: 'background_completed',
        taskId,
        status,
        preview: task.resultPreview,
      });
    }, duration);
  }
}
