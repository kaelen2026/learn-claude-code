import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '../../shared/types.js';
import type { TaskStore } from '../../stores/tasks/task-store.js';
import { addTaskDependencies, unlockTaskDependents } from './dependency-graph.js';
import { isTaskReady } from './ready-rule.js';
import { formatTask, TaskManager } from './task-manager.js';

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 1,
    subject: 'Test task',
    description: '',
    status: 'pending',
    blockedBy: [],
    blocks: [],
    owner: '',
    ...overrides,
  };
}

function createMockStore() {
  const data = new Map<number, TaskRecord>();
  return {
    data,
    async loadAll() {
      return [...data.values()].sort((a, b) => a.id - b.id);
    },
    async get(id: number) {
      return data.get(id) ?? null;
    },
    async save(task: TaskRecord) {
      data.set(task.id, { ...task });
    },
  } as unknown as TaskStore & { data: Map<number, TaskRecord> };
}

describe('isTaskReady', () => {
  it('returns true for pending task with no blockers', () => {
    expect(isTaskReady(makeTask())).toBe(true);
  });

  it('returns false for non-pending tasks', () => {
    expect(isTaskReady(makeTask({ status: 'in_progress' }))).toBe(false);
    expect(isTaskReady(makeTask({ status: 'completed' }))).toBe(false);
    expect(isTaskReady(makeTask({ status: 'deleted' }))).toBe(false);
  });

  it('returns false for tasks with blockers', () => {
    expect(isTaskReady(makeTask({ blockedBy: [2] }))).toBe(false);
  });
});

describe('addTaskDependencies', () => {
  it('adds bidirectional dependency', async () => {
    const store = createMockStore();
    const task = makeTask({ id: 2 });
    const blocker = makeTask({ id: 1 });
    store.data.set(1, blocker);
    store.data.set(2, task);

    await addTaskDependencies(store, task, [1]);

    expect(task.blockedBy).toContain(1);
    expect(store.data.get(1)!.blocks).toContain(2);
  });

  it('skips missing blockers', async () => {
    const store = createMockStore();
    const task = makeTask({ id: 1 });
    store.data.set(1, task);

    await addTaskDependencies(store, task, [99]);
    expect(task.blockedBy).toEqual([]);
  });
});

describe('unlockTaskDependents', () => {
  it('removes completed task from dependents blockedBy', async () => {
    const store = createMockStore();
    const blocker = makeTask({ id: 1, blocks: [2] });
    const dependent = makeTask({ id: 2, blockedBy: [1] });
    store.data.set(1, blocker);
    store.data.set(2, dependent);

    await unlockTaskDependents(store, blocker);

    expect(store.data.get(2)!.blockedBy).toEqual([]);
  });
});

describe('TaskManager', () => {
  it('creates tasks with incrementing IDs', async () => {
    const store = createMockStore();
    const manager = new TaskManager(store);

    const t1 = await manager.create('Task 1');
    const t2 = await manager.create('Task 2');

    expect(t1.id).toBe(1);
    expect(t2.id).toBe(2);
  });

  it('inits nextId from existing tasks', async () => {
    const store = createMockStore();
    store.data.set(5, makeTask({ id: 5, subject: 'Existing' }));

    const manager = new TaskManager(store);
    await manager.init();

    const task = await manager.create('New');
    expect(task.id).toBe(6);
  });

  it('lists non-deleted tasks', async () => {
    const store = createMockStore();
    store.data.set(1, makeTask({ id: 1 }));
    store.data.set(2, makeTask({ id: 2, status: 'deleted' }));

    const manager = new TaskManager(store);
    const tasks = await manager.list();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(1);
  });

  it('updates task fields', async () => {
    const store = createMockStore();
    store.data.set(1, makeTask({ id: 1 }));

    const manager = new TaskManager(store);
    const updated = await manager.update(1, { status: 'in_progress', owner: 'alice' });

    expect(updated?.status).toBe('in_progress');
    expect(updated?.owner).toBe('alice');
  });

  it('returns null for missing task', async () => {
    const store = createMockStore();
    const manager = new TaskManager(store);
    expect(await manager.get(99)).toBeNull();
    expect(await manager.update(99, { status: 'completed' })).toBeNull();
  });

  it('getReadyTasks filters correctly', async () => {
    const store = createMockStore();
    store.data.set(1, makeTask({ id: 1 }));
    store.data.set(2, makeTask({ id: 2, status: 'in_progress' }));
    store.data.set(3, makeTask({ id: 3, blockedBy: [1] }));

    const manager = new TaskManager(store);
    const ready = await manager.getReadyTasks();
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe(1);
  });
});

describe('formatTask', () => {
  it('includes status icon and subject', () => {
    const task = makeTask({ subject: 'My task' });
    const result = formatTask(task, { isReady: () => true });
    expect(result).toContain('⏳');
    expect(result).toContain('#1');
    expect(result).toContain('My task');
    expect(result).toContain('READY');
  });

  it('shows blocker info', () => {
    const task = makeTask({ blockedBy: [2, 3] });
    const result = formatTask(task, { isReady: () => false });
    expect(result).toContain('被阻塞: [2, 3]');
    expect(result).not.toContain('READY');
  });
});
