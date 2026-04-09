import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { RuntimeTaskRecord } from '../../shared/types.js';
import { BackgroundManager } from './background-manager.js';
import { NotificationQueue } from './notification-queue.js';

function createMockStore() {
  const data = new Map<string, RuntimeTaskRecord>();
  return {
    data,
    async loadAll() {
      return [...data.values()];
    },
    async get(id: string) {
      return data.get(id) ?? null;
    },
    async save(task: RuntimeTaskRecord) {
      data.set(task.id, { ...task });
    },
  } as any;
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'bg-test-'));
}

describe('BackgroundManager', () => {
  it('assigns incrementing IDs', async () => {
    const store = createMockStore();
    const queue = new NotificationQueue();
    const manager = new BackgroundManager(store, makeTempDir(), queue);

    const id1 = await manager.run('echo a');
    const id2 = await manager.run('echo b');

    expect(id1).toBe('bg_1');
    expect(id2).toBe('bg_2');
  });

  it('stores task as running initially', async () => {
    const store = createMockStore();
    const queue = new NotificationQueue();
    const manager = new BackgroundManager(store, makeTempDir(), queue);

    const id = await manager.run('echo test');
    const task = await manager.check(id);

    expect(task).not.toBeNull();
    expect(task!.status).toBe('running');
    expect(task!.command).toBe('echo test');
  });

  it('completes with real output and notifies', async () => {
    const store = createMockStore();
    const queue = new NotificationQueue();
    const manager = new BackgroundManager(store, makeTempDir(), queue);

    const id = await manager.run('echo hello_bg_test');

    // Wait for the background command to complete
    await vi.waitFor(
      async () => {
        const task = await manager.check(id);
        expect(task!.status).toBe('completed');
      },
      { timeout: 5000 },
    );

    const task = await manager.check(id);
    expect(task!.resultPreview).toContain('hello_bg_test');

    const notifications = manager.drainNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('background_completed');
    expect(notifications[0]).toHaveProperty('status', 'completed');
  });

  it('marks failed commands', async () => {
    const store = createMockStore();
    const queue = new NotificationQueue();
    const manager = new BackgroundManager(store, makeTempDir(), queue);

    const id = await manager.run('exit 1');

    await vi.waitFor(
      async () => {
        const task = await manager.check(id);
        expect(task!.status).toBe('failed');
      },
      { timeout: 5000 },
    );

    const notifications = manager.drainNotifications();
    expect(notifications[0]).toHaveProperty('status', 'failed');
  });

  it('lists all tasks', async () => {
    const store = createMockStore();
    const queue = new NotificationQueue();
    const manager = new BackgroundManager(store, makeTempDir(), queue);

    await manager.run('echo a');
    await manager.run('echo b');

    const tasks = await manager.listAll();
    expect(tasks).toHaveLength(2);
  });
});

describe('NotificationQueue', () => {
  it('drains all notifications and clears', () => {
    const queue = new NotificationQueue();
    queue.push({ type: 'background_completed', taskId: '1', status: 'completed', preview: 'ok' });
    queue.push({ type: 'background_completed', taskId: '2', status: 'failed', preview: 'err' });

    const drained = queue.drain();
    expect(drained).toHaveLength(2);
    expect(queue.drain()).toHaveLength(0);
  });
});
