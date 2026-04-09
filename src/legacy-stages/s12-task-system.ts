/**
 * Stage 12: Task System（任务系统）
 *
 * 区别于 s03 的 todo（仅内存、无依赖、单会话）：
 * - 持久化：一任务一文件（.tasks/task_N.json）
 * - 依赖关系：双向图（blockedBy / blocks）
 * - 就绪判断：Ready Rule — status == pending AND blockedBy 为空
 * - 自动解锁：任务完成时，从所有依赖它的任务的 blockedBy 中移除
 *
 * TaskRecord 结构：
 * { id, subject, description, status, blockedBy, blocks, owner }
 *
 * 状态枚举：pending → in_progress → completed | deleted
 *
 * 学习要点：
 * - 任务持久化（JSON 文件）
 * - 依赖关系双向维护
 * - 就绪判断逻辑
 * - 跨会话任务追踪
 */

import type Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';
import type { Tool } from '../core/types.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

type TaskRecordStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

interface TaskRecord {
  id: number;
  subject: string;
  description: string;
  status: TaskRecordStatus;
  blockedBy: number[];
  blocks: number[];
  owner: string;
}

// ============ TaskManager ============

class TaskManager {
  private tasksDir: string;
  private nextId = 1;

  constructor(tasksDir: string) {
    this.tasksDir = tasksDir;
  }

  async init() {
    if (!existsSync(this.tasksDir)) {
      await mkdir(this.tasksDir, { recursive: true });
    }
    // 扫描已有任务确定下一个 ID
    const tasks = await this.loadAll();
    if (tasks.length > 0) {
      this.nextId = Math.max(...tasks.map((t) => t.id)) + 1;
    }
  }

  /** 创建任务 */
  async create(subject: string, description = ''): Promise<TaskRecord> {
    const task: TaskRecord = {
      id: this.nextId++,
      subject,
      description,
      status: 'pending',
      blockedBy: [],
      blocks: [],
      owner: '',
    };
    await this.save(task);
    return task;
  }

  /** 获取单个任务 */
  async get(id: number): Promise<TaskRecord | null> {
    const filepath = join(this.tasksDir, `task_${id}.json`);
    if (!existsSync(filepath)) return null;
    const raw = await readFile(filepath, 'utf-8');
    return JSON.parse(raw);
  }

  /** 列出所有任务（排除已删除） */
  async list(): Promise<TaskRecord[]> {
    const all = await this.loadAll();
    return all.filter((t) => t.status !== 'deleted');
  }

  /** 更新任务 */
  async update(
    id: number,
    updates: Partial<Pick<TaskRecord, 'status' | 'owner' | 'description' | 'subject'>>,
  ): Promise<TaskRecord | null> {
    const task = await this.get(id);
    if (!task) return null;

    if (updates.status) task.status = updates.status;
    if (updates.owner !== undefined) task.owner = updates.owner;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.subject !== undefined) task.subject = updates.subject;

    // 完成时自动解锁依赖
    if (updates.status === 'completed') {
      await this.unlockDependents(task.id);
    }

    await this.save(task);
    return task;
  }

  /** 添加依赖关系：taskId 被 blockerIds 阻塞 */
  async addBlockedBy(taskId: number, blockerIds: number[]): Promise<TaskRecord | null> {
    const task = await this.get(taskId);
    if (!task) return null;

    for (const blockerId of blockerIds) {
      const blocker = await this.get(blockerId);
      if (!blocker) continue;

      // 双向维护
      if (!task.blockedBy.includes(blockerId)) {
        task.blockedBy.push(blockerId);
      }
      if (!blocker.blocks.includes(taskId)) {
        blocker.blocks.push(taskId);
        await this.save(blocker);
      }
    }

    await this.save(task);
    return task;
  }

  /** Ready Rule：status == pending AND blockedBy 为空 */
  isReady(task: TaskRecord): boolean {
    return task.status === 'pending' && task.blockedBy.length === 0;
  }

  /** 获取所有就绪任务 */
  async getReadyTasks(): Promise<TaskRecord[]> {
    const tasks = await this.list();
    return tasks.filter((t) => this.isReady(t));
  }

  // ---- 内部方法 ----

  private async save(task: TaskRecord) {
    const filepath = join(this.tasksDir, `task_${task.id}.json`);
    await writeFile(filepath, JSON.stringify(task, null, 2), 'utf-8');
  }

  private async loadAll(): Promise<TaskRecord[]> {
    if (!existsSync(this.tasksDir)) return [];
    const files = await readdir(this.tasksDir);
    const tasks: TaskRecord[] = [];
    for (const file of files) {
      if (!file.startsWith('task_') || !file.endsWith('.json')) continue;
      const raw = await readFile(join(this.tasksDir, file), 'utf-8');
      tasks.push(JSON.parse(raw));
    }
    return tasks.sort((a, b) => a.id - b.id);
  }

  /** 当任务完成时，从依赖它的任务的 blockedBy 中移除 */
  private async unlockDependents(completedId: number) {
    const task = await this.get(completedId);
    if (!task) return;

    for (const dependentId of task.blocks) {
      const dependent = await this.get(dependentId);
      if (!dependent) continue;
      dependent.blockedBy = dependent.blockedBy.filter((id) => id !== completedId);
      await this.save(dependent);

      if (this.isReady(dependent)) {
        console.log(`  🔓 任务 #${dependentId} "${dependent.subject}" 已解锁！`);
      }
    }
  }
}

// ============ 工具定义 ============

function createTaskTools(manager: TaskManager): Tool[] {
  const taskCreateTool: Tool = {
    name: 'task_create',
    description: '创建一个新任务，可选设置描述',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: '任务标题（单句描述）' },
        description: { type: 'string', description: '补充说明（可选）' },
      },
      required: ['subject'],
    },
    execute: async (params) => {
      const task = await manager.create(
        params.subject as string,
        (params.description as string) || '',
      );
      return `任务创建成功: #${task.id} "${task.subject}"`;
    },
  };

  const taskUpdateTool: Tool = {
    name: 'task_update',
    description: '更新任务的状态、负责人或描述。设置依赖请用 blockedBy 参数。',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '任务 ID' },
        status: { type: 'string', description: '新状态: pending, in_progress, completed, deleted' },
        owner: { type: 'string', description: '负责人' },
        description: { type: 'string', description: '更新描述' },
        blockedBy: {
          type: 'array',
          description: '前置依赖任务 ID 列表',
        },
      },
      required: ['id'],
    },
    execute: async (params) => {
      const id = params.id as number;

      // 处理依赖关系
      if (params.blockedBy) {
        const blockerIds = params.blockedBy as number[];
        await manager.addBlockedBy(id, blockerIds);
      }

      // 处理其他字段更新
      const updates: Partial<Pick<TaskRecord, 'status' | 'owner' | 'description'>> = {};
      if (params.status) updates.status = params.status as TaskRecordStatus;
      if (params.owner !== undefined) updates.owner = params.owner as string;
      if (params.description !== undefined) updates.description = params.description as string;

      if (Object.keys(updates).length > 0) {
        const task = await manager.update(id, updates);
        if (!task) return `错误: 任务 #${id} 不存在`;
        return formatTask(task, manager);
      }

      const task = await manager.get(id);
      if (!task) return `错误: 任务 #${id} 不存在`;
      return formatTask(task, manager);
    },
  };

  const taskGetTool: Tool = {
    name: 'task_get',
    description: '查询单个任务的详细信息',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '任务 ID' },
      },
      required: ['id'],
    },
    execute: async (params) => {
      const task = await manager.get(params.id as number);
      if (!task) return `错误: 任务 #${params.id} 不存在`;
      return formatTask(task, manager);
    },
  };

  const taskListTool: Tool = {
    name: 'task_list',
    description: '列出所有任务，显示状态、依赖和就绪情况',
    input_schema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const tasks = await manager.list();
      if (tasks.length === 0) return '当前没有任务';

      const ready = tasks.filter((t) => manager.isReady(t));
      const lines = tasks.map((t) => {
        const readyFlag = manager.isReady(t) ? ' 🟢 READY' : '';
        const blockedInfo =
          t.blockedBy.length > 0 ? ` ⛓️ blocked by: [${t.blockedBy.join(', ')}]` : '';
        const ownerInfo = t.owner ? ` 👤 ${t.owner}` : '';
        return `  ${statusIcon(t.status)} #${t.id} ${t.subject}${ownerInfo}${blockedInfo}${readyFlag}`;
      });

      return `任务列表 (${tasks.length} 个, ${ready.length} 个就绪):\n${lines.join('\n')}`;
    },
  };

  return [taskCreateTool, taskUpdateTool, taskGetTool, taskListTool];
}

// ============ 辅助函数 ============

function statusIcon(status: TaskRecordStatus): string {
  return { pending: '⏳', in_progress: '🔄', completed: '✅', deleted: '🗑️' }[status];
}

function formatTask(task: TaskRecord, manager: TaskManager): string {
  const ready = manager.isReady(task) ? ' 🟢 READY' : '';
  const lines = [
    `${statusIcon(task.status)} #${task.id} ${task.subject}${ready}`,
    `   状态: ${task.status}`,
  ];
  if (task.description) lines.push(`   描述: ${task.description}`);
  if (task.owner) lines.push(`   负责人: ${task.owner}`);
  if (task.blockedBy.length > 0) lines.push(`   被阻塞: [${task.blockedBy.join(', ')}]`);
  if (task.blocks.length > 0) lines.push(`   阻塞: [${task.blocks.join(', ')}]`);
  return lines.join('\n');
}

// ============ 代理循环 ============

const SYSTEM_PROMPT = `你是一个任务管理 AI 助手，支持持久化任务和依赖关系。

你有以下工具：
- task_create: 创建新任务
- task_update: 更新任务（状态、负责人、依赖）
- task_get: 查询单个任务
- task_list: 列出所有任务

## 任务状态
pending → in_progress → completed（或 deleted）

## 依赖关系
- 用 task_update 的 blockedBy 设置前置依赖
- 当前置任务完成时，依赖它的任务会自动解锁
- 只有状态为 pending 且无阻塞的任务才是"就绪"的

## 工作方式
1. 将用户需求拆分为任务，建立依赖关系
2. 用 task_list 展示任务看板
3. 按依赖顺序推进任务`;

async function agentLoopWithTasks(userInput: string) {
  const tasksDir = join(process.cwd(), '.tasks');
  const manager = new TaskManager(tasksDir);
  await manager.init();

  console.log('🤖 启动任务系统代理...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const tools = createTaskTools(manager);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userInput }];

  const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));

  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 15;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    console.log(`🔄 循环 ${loopCount}...\n`);

    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools: anthropicTools,
    });

    console.log(`📊 Stop reason: ${response.stop_reason}\n`);

    messages.push({
      role: 'assistant',
      content: response.content,
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`🤖 Claude: ${block.text}\n`);
      } else if (block.type === 'tool_use') {
        console.log(`🔧 调用工具: ${block.name}`);
        console.log(`📝 参数:`, JSON.stringify(block.input, null, 2), '\n');

        const tool = tools.find((t) => t.name === block.name);
        if (tool) {
          const result = await tool.execute(block.input as Record<string, unknown>);
          console.log(`✅ 结果: ${result}\n`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }

    if (response.stop_reason === 'end_turn') {
      continueLoop = false;
      console.log('✅ 对话结束\n');
    } else if (response.stop_reason === 'tool_use') {
      continueLoop = true;
      console.log('🔄 继续处理...\n');
    }
  }

  // 展示最终任务状态
  console.log('=== 最终任务看板 ===');
  const allTasks = await manager.list();
  for (const t of allTasks) {
    const ready = manager.isReady(t) ? ' 🟢' : '';
    const blocked = t.blockedBy.length > 0 ? ` ⛓️[${t.blockedBy.join(',')}]` : '';
    console.log(`  ${statusIcon(t.status)} #${t.id} ${t.subject}${blocked}${ready}`);
  }
}

// ============ 演示 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 12: Task System 示例 ===\n');

  await agentLoopWithTasks(
    '请帮我规划一个用户认证系统的开发任务：\n1. 设计数据库 schema\n2. 实现注册 API（依赖 schema）\n3. 实现登录 API（依赖 schema）\n4. 编写测试（依赖注册和登录 API）\n请创建任务并设置依赖关系，然后展示任务看板。',
  );
}

export type { TaskRecord, TaskRecordStatus };
export { agentLoopWithTasks, TaskManager };
