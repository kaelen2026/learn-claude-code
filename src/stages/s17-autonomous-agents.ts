/**
 * Stage 17: Autonomous Agents（自主代理）
 *
 * 自主性定义：不是完全独立，而是"成员可在预定义规则内决定下一步工作"。
 *
 * 状态机：
 * WORK → IDLE → (check inbox) → resume
 *                (scan tasks) → claim → WORK
 *                (timeout) → shutdown
 *
 * 关键机制：
 * - Claimable Task: status=pending, no owner, no blockedBy, role matches
 * - Atomic Claiming: 锁保护防并发
 * - Claim Event Log: 谁在什么时候做了什么
 *
 * 学习要点：
 * - 自主任务扫描与认领
 * - 角色过滤
 * - 事件日志
 * - 空闲轮询与超时
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFile, readFile, mkdir, appendFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Tool } from '../core/types.js';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

interface AutoTask {
  id: number;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  owner: string;
  claimRole: string;  // 需要的角色
  blockedBy: number[];
}

interface ClaimEvent {
  event: string;
  taskId: number;
  owner: string;
  source: 'auto' | 'manual';
  ts: number;
}

interface AutonomousAgent {
  name: string;
  role: string;
  status: 'idle' | 'working' | 'shutdown';
}

// ============ TaskBoard ============

class TaskBoard {
  private tasks = new Map<number, AutoTask>();
  private nextId = 1;
  private claiming = false;  // 简单锁
  private eventsFile: string;

  constructor(private dir: string) {
    this.eventsFile = join(dir, 'claim_events.jsonl');
  }

  async init() {
    if (!existsSync(this.dir)) await mkdir(this.dir, { recursive: true });
  }

  addTask(subject: string, claimRole: string, blockedBy: number[] = []): AutoTask {
    const task: AutoTask = { id: this.nextId++, subject, status: 'pending', owner: '', claimRole, blockedBy };
    this.tasks.set(task.id, task);
    return task;
  }

  /** 查找可认领的任务（Claimable Task Predicate） */
  findClaimable(role: string): AutoTask | undefined {
    return Array.from(this.tasks.values()).find(
      (t) => t.status === 'pending' && !t.owner && t.blockedBy.length === 0 && t.claimRole === role
    );
  }

  /** 原子认领 */
  async claim(taskId: number, owner: string, source: 'auto' | 'manual' = 'auto'): Promise<boolean> {
    if (this.claiming) return false;
    this.claiming = true;
    try {
      const task = this.tasks.get(taskId);
      if (!task || task.owner || task.status !== 'pending') return false;
      task.owner = owner;
      task.status = 'in_progress';
      // 记录事件
      const event: ClaimEvent = { event: 'task.claimed', taskId, owner, source, ts: Date.now() };
      await appendFile(this.eventsFile, JSON.stringify(event) + '\n', 'utf-8');
      return true;
    } finally {
      this.claiming = false;
    }
  }

  complete(taskId: number) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'completed';
    // 解锁依赖
    for (const t of this.tasks.values()) {
      t.blockedBy = t.blockedBy.filter((id) => id !== taskId);
    }
  }

  list(): AutoTask[] {
    return Array.from(this.tasks.values());
  }
}

// ============ 自主代理循环 ============

async function autonomousAgentLoop(
  agent: AutonomousAgent,
  board: TaskBoard,
  maxCycles: number = 3
): Promise<string[]> {
  const results: string[] = [];
  let idleCycles = 0;
  const MAX_IDLE = 2;

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    // 1. 扫描可认领任务
    const claimable = board.findClaimable(agent.role);

    if (!claimable) {
      idleCycles++;
      console.log(`  💤 ${agent.name} 空闲 (${idleCycles}/${MAX_IDLE})`);
      if (idleCycles >= MAX_IDLE) {
        agent.status = 'shutdown';
        console.log(`  🛑 ${agent.name} 超时关停\n`);
        break;
      }
      continue;
    }

    // 2. 认领任务
    const claimed = await board.claim(claimable.id, agent.name);
    if (!claimed) continue;

    agent.status = 'working';
    idleCycles = 0;
    console.log(`  🎯 ${agent.name} 认领任务 #${claimable.id}: ${claimable.subject}`);

    // 3. 执行任务（独立 Claude 调用）
    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 512,
      system: `你是 ${agent.name}（角色: ${agent.role}）。简洁完成任务，100 字以内。`,
      messages: [{ role: 'user', content: `完成任务: ${claimable.subject}` }],
    });

    const result = response.content.filter((b) => b.type === 'text').map((b) => (b as { type: 'text'; text: string }).text).join('');
    board.complete(claimable.id);
    agent.status = 'idle';

    console.log(`  ✅ ${agent.name} 完成 #${claimable.id}\n`);
    results.push(`#${claimable.id} ${claimable.subject}: ${result.slice(0, 150)}`);
  }

  return results;
}

// ============ 演示 ============

async function demo() {
  const dir = join(process.cwd(), '.autonomous');
  const board = new TaskBoard(dir);
  await board.init();

  // 创建任务（带角色要求和依赖）
  const t1 = board.addTask('编写用户模型', 'coder');
  const t2 = board.addTask('编写 API 路由', 'coder', [t1.id]);
  const t3 = board.addTask('编写单元测试', 'tester');
  const t4 = board.addTask('代码审查', 'reviewer', [t1.id]);

  console.log('📋 任务看板:');
  for (const t of board.list()) {
    const blocked = t.blockedBy.length > 0 ? ` ⛓️[${t.blockedBy}]` : '';
    console.log(`  ⏳ #${t.id} ${t.subject} [${t.claimRole}]${blocked}`);
  }
  console.log();

  // 创建自主代理
  const agents: AutonomousAgent[] = [
    { name: 'alice', role: 'coder', status: 'idle' },
    { name: 'bob', role: 'tester', status: 'idle' },
    { name: 'carol', role: 'reviewer', status: 'idle' },
  ];

  console.log('🤖 自主代理:');
  agents.forEach((a) => console.log(`  ${a.name} (${a.role})`));
  console.log();

  // 并行运行自主代理
  console.log('--- 第 1 轮自主执行 ---\n');
  const round1 = await Promise.all(agents.map((a) => autonomousAgentLoop(a, board, 2)));

  console.log('--- 第 2 轮自主执行（依赖解锁后）---\n');
  // 重置 agent 状态
  agents.forEach((a) => { if (a.status === 'shutdown') a.status = 'idle'; });
  const round2 = await Promise.all(agents.map((a) => autonomousAgentLoop(a, board, 2)));

  // 最终状态
  console.log('=== 最终任务状态 ===');
  for (const t of board.list()) {
    const icon = { pending: '⏳', in_progress: '🔄', completed: '✅' }[t.status];
    const owner = t.owner ? ` 👤${t.owner}` : '';
    console.log(`  ${icon} #${t.id} ${t.subject}${owner}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 17: Autonomous Agents 示例 ===\n');
  await demo();
}

export { autonomousAgentLoop, TaskBoard };
export type { AutoTask, AutonomousAgent, ClaimEvent };
