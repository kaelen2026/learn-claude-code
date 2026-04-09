/**
 * Stage 18: Worktree Isolation（工作树隔离）
 *
 * Task 回答"做什么"（目标和状态），Worktree 回答"在哪做"（隔离目录）。
 * 两者通过 task_id 关联但保持独立。
 *
 * 执行流程（五步）：
 * 1. 任务创建（Task Manager）
 * 2. 分配 worktree（基于 git worktree）
 * 3. 同时更新两边记录
 * 4. 进入车道 → 执行命令（cwd 切换）
 * 5. 显式收尾（keep 或 remove）
 *
 * 学习要点：
 * - 工作树创建与管理
 * - 任务与工作树的绑定
 * - 隔离执行（cwd 切换）
 * - 显式收尾（CloseoutRecord）
 * - 事件日志追踪生命周期
 */

import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ============ 数据结构 ============

type WorktreeStatus = 'active' | 'kept' | 'removed';

interface WorktreeRecord {
  name: string;
  path: string;
  branch: string;
  taskId: number | null;
  status: WorktreeStatus;
  lastEnteredAt: number | null;
  lastCommandAt: number | null;
  closeout: CloseoutRecord | null;
}

interface CloseoutRecord {
  action: 'keep' | 'remove';
  reason: string;
  timestamp: number;
}

interface WorktreeEvent {
  event: string;
  taskId: number | null;
  worktree: string;
  ts: number;
}

interface WorktreeTask {
  id: number;
  subject: string;
  worktree: string;
  worktreeState: 'active' | 'kept' | 'removed' | 'unbound';
}

// ============ WorktreeManager ============

class WorktreeManager {
  private worktrees = new Map<string, WorktreeRecord>();
  private tasks = new Map<number, WorktreeTask>();
  private events: WorktreeEvent[] = [];
  private baseDir: string;
  private nextTaskId = 1;

  constructor(baseDir: string) {
    this.baseDir = join(baseDir, '.worktrees');
  }

  async init() {
    if (!existsSync(this.baseDir)) await mkdir(this.baseDir, { recursive: true });
  }

  /** 创建任务 */
  createTask(subject: string): WorktreeTask {
    const task: WorktreeTask = { id: this.nextTaskId++, subject, worktree: '', worktreeState: 'unbound' };
    this.tasks.set(task.id, task);
    return task;
  }

  /** 创建工作树并绑定任务 */
  create(name: string, taskId: number): WorktreeRecord {
    const path = join(this.baseDir, name);
    const record: WorktreeRecord = {
      name, path, branch: `worktree/${name}`,
      taskId, status: 'active',
      lastEnteredAt: null, lastCommandAt: null, closeout: null,
    };
    this.worktrees.set(name, record);

    // 更新任务绑定
    const task = this.tasks.get(taskId);
    if (task) { task.worktree = name; task.worktreeState = 'active'; }

    this.logEvent('worktree.created', taskId, name);

    // 模拟创建目录
    if (!existsSync(path)) mkdir(path, { recursive: true });

    return record;
  }

  /** 进入工作树 */
  enter(name: string): WorktreeRecord | null {
    const wt = this.worktrees.get(name);
    if (!wt || wt.status !== 'active') return null;
    wt.lastEnteredAt = Date.now();
    this.logEvent('worktree.entered', wt.taskId, name);
    return wt;
  }

  /** 在工作树中执行命令（模拟 cwd 切换） */
  run(name: string, command: string): string {
    const wt = this.worktrees.get(name);
    if (!wt) return `工作树 ${name} 不存在`;
    wt.lastCommandAt = Date.now();
    this.logEvent('worktree.command', wt.taskId, name);
    return `[在 ${wt.path} 中执行] $ ${command}\n(ok, cwd=${wt.path})`;
  }

  /** 显式收尾 */
  closeout(name: string, action: 'keep' | 'remove', reason: string): string {
    const wt = this.worktrees.get(name);
    if (!wt) return `工作树 ${name} 不存在`;

    wt.closeout = { action, reason, timestamp: Date.now() };
    wt.status = action === 'keep' ? 'kept' : 'removed';

    const task = wt.taskId ? this.tasks.get(wt.taskId) : null;
    if (task) task.worktreeState = wt.status;

    this.logEvent(`worktree.closeout.${action}`, wt.taskId, name);
    return `工作树 ${name} 已${action === 'keep' ? '保留' : '移除'}: ${reason}`;
  }

  list(): WorktreeRecord[] { return Array.from(this.worktrees.values()); }
  listTasks(): WorktreeTask[] { return Array.from(this.tasks.values()); }
  getEvents(): WorktreeEvent[] { return this.events; }

  private logEvent(event: string, taskId: number | null, worktree: string) {
    this.events.push({ event, taskId, worktree, ts: Date.now() });
  }
}

// ============ 演示 ============

async function demo() {
  const manager = new WorktreeManager(process.cwd());
  await manager.init();

  // Step 1: 创建任务
  console.log('📋 Step 1: 创建任务\n');
  const task1 = manager.createTask('重构认证模块');
  const task2 = manager.createTask('修复分页 Bug');
  console.log(`  #${task1.id} ${task1.subject} (${task1.worktreeState})`);
  console.log(`  #${task2.id} ${task2.subject} (${task2.worktreeState})\n`);

  // Step 2: 分配工作树
  console.log('🌳 Step 2: 分配工作树\n');
  const wt1 = manager.create('auth-refactor', task1.id);
  const wt2 = manager.create('fix-pagination', task2.id);
  console.log(`  ${wt1.name} → 任务 #${wt1.taskId} (${wt1.branch})`);
  console.log(`  ${wt2.name} → 任务 #${wt2.taskId} (${wt2.branch})\n`);

  // Step 3: 进入并执行
  console.log('🔧 Step 3: 进入工作树并执行命令\n');
  manager.enter('auth-refactor');
  console.log(`  ${manager.run('auth-refactor', 'npm run test:auth')}`);
  manager.enter('fix-pagination');
  console.log(`  ${manager.run('fix-pagination', 'git diff src/pagination.ts')}\n`);

  // Step 4: 收尾
  console.log('🏁 Step 4: 显式收尾\n');
  console.log(`  ${manager.closeout('auth-refactor', 'keep', '还需要进一步测试')}`);
  console.log(`  ${manager.closeout('fix-pagination', 'remove', 'Bug 已修复并合并')}\n`);

  // 最终状态
  console.log('=== 工作树状态 ===');
  for (const wt of manager.list()) {
    const icon = { active: '🟢', kept: '📦', removed: '🗑️' }[wt.status];
    console.log(`  ${icon} ${wt.name} → ${wt.status}${wt.closeout ? ` (${wt.closeout.reason})` : ''}`);
  }

  console.log('\n=== 任务绑定状态 ===');
  for (const t of manager.listTasks()) {
    console.log(`  #${t.id} ${t.subject} → worktree: ${t.worktree || 'none'} (${t.worktreeState})`);
  }

  console.log('\n=== 事件日志 ===');
  for (const e of manager.getEvents()) {
    console.log(`  [${new Date(e.ts).toLocaleTimeString()}] ${e.event} | worktree=${e.worktree} task=${e.taskId}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 18: Worktree Isolation 示例 ===\n');
  await demo();
}

export { WorktreeManager };
export type { WorktreeRecord, WorktreeTask, CloseoutRecord, WorktreeEvent };
