/**
 * Stage 13: Background Tasks（后台任务）
 *
 * 解决慢操作（npm install、pytest 等）阻塞主循环的问题。
 * 核心原则："主循环仍然只有一条，并行的是等待，不是主循环本身"
 *
 * 流程：
 *   主循环
 *     ├── background_run("pytest") → 立刻返回 task_id
 *     ├── 继续别的工作
 *     └── 下一轮模型调用前 → drain_notifications()
 *
 * 关键设计：
 * - 完整输出写磁盘，通知只放 500 字摘要
 * - 通知队列使用同 key 折叠，避免上下文爆炸
 * - RuntimeTaskRecord 管理运行时状态
 * - 线程安全（Promise 天然串行 + 锁保护共享状态）
 *
 * 学习要点：
 * - 后台执行与通知队列
 * - 异步任务管理
 * - 主循环与后台任务的协调
 */

import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Tool } from '../core/types.js';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

type RuntimeTaskStatus = 'running' | 'completed' | 'failed';

interface RuntimeTaskRecord {
  id: string;
  command: string;
  status: RuntimeTaskStatus;
  startedAt: number;
  resultPreview: string;
  outputFile: string;
}

interface Notification {
  type: 'background_completed';
  taskId: string;
  status: RuntimeTaskStatus;
  preview: string;
}

// ============ BackgroundManager ============

class BackgroundManager {
  private tasks = new Map<string, RuntimeTaskRecord>();
  private notifications: Notification[] = [];
  private outputDir: string;
  private nextId = 1;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async init() {
    if (!existsSync(this.outputDir)) {
      await mkdir(this.outputDir, { recursive: true });
    }
  }

  /** 启动后台任务，立刻返回 task_id */
  run(command: string): string {
    const id = `bg_${this.nextId++}`;
    const task: RuntimeTaskRecord = {
      id,
      command,
      status: 'running',
      startedAt: Date.now(),
      resultPreview: '',
      outputFile: '',
    };
    this.tasks.set(id, task);

    // 异步执行，不阻塞
    this.execute(id, command);

    return id;
  }

  /** 检查任务状态 */
  check(id: string): RuntimeTaskRecord | null {
    return this.tasks.get(id) || null;
  }

  /** 列出所有任务 */
  listAll(): RuntimeTaskRecord[] {
    return Array.from(this.tasks.values());
  }

  /** 排空通知队列（在模型调用前执行） */
  drainNotifications(): Notification[] {
    const drained = [...this.notifications];
    this.notifications = [];
    return drained;
  }

  // ---- 内部方法 ----

  private execute(taskId: string, command: string) {
    // 使用模拟执行（演示用，避免真正执行命令）
    const duration = 1000 + Math.random() * 2000; // 1-3 秒

    setTimeout(async () => {
      const task = this.tasks.get(taskId);
      if (!task) return;

      // 模拟输出
      const output = `$ ${command}\n${'='.repeat(40)}\n[模拟] 命令执行完成\n耗时: ${Math.round(duration)}ms\n退出码: 0\n${'='.repeat(40)}`;

      // 完整输出写磁盘
      const outputFile = join(this.outputDir, `${taskId}.txt`);
      await writeFile(outputFile, output, 'utf-8');

      // 更新任务状态
      task.status = 'completed';
      task.resultPreview = output.slice(0, 500);
      task.outputFile = outputFile;

      // 写入通知队列
      this.notifications.push({
        type: 'background_completed',
        taskId,
        status: 'completed',
        preview: task.resultPreview,
      });

      console.log(`  📬 后台任务 ${taskId} 完成: "${command}"\n`);
    }, duration);
  }
}

// ============ 工具定义 ============

function createBgTools(bgManager: BackgroundManager): Tool[] {
  const backgroundRunTool: Tool = {
    name: 'background_run',
    description: '在后台启动一个慢命令，立刻返回任务 ID。命令完成后会收到通知。',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
      },
      required: ['command'],
    },
    execute: async (params) => {
      const id = bgManager.run(params.command as string);
      return `后台任务已启动: ${id}\n命令: ${params.command}\n任务将在后台执行，完成后你会收到通知。`;
    },
  };

  const checkBackgroundTool: Tool = {
    name: 'check_background',
    description: '检查后台任务的状态',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '任务 ID（不传则列出全部）' },
      },
    },
    execute: async (params) => {
      if (params.task_id) {
        const task = bgManager.check(params.task_id as string);
        if (!task) return `未找到任务: ${params.task_id}`;
        return formatRuntimeTask(task);
      }
      const all = bgManager.listAll();
      if (all.length === 0) return '当前没有后台任务';
      return all.map(formatRuntimeTask).join('\n---\n');
    },
  };

  const bashTool: Tool = {
    name: 'bash',
    description: '同步执行短命令（会阻塞，适合快速命令）',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell 命令' },
      },
      required: ['command'],
    },
    execute: async (params) => {
      return `[模拟同步] $ ${params.command}\n(ok)`;
    },
  };

  return [backgroundRunTool, checkBackgroundTool, bashTool];
}

function formatRuntimeTask(task: RuntimeTaskRecord): string {
  const icon = { running: '🔄', completed: '✅', failed: '❌' }[task.status];
  const elapsed = Math.round((Date.now() - task.startedAt) / 1000);
  const lines = [
    `${icon} ${task.id}: ${task.command}`,
    `   状态: ${task.status} | 已运行: ${elapsed}s`,
  ];
  if (task.resultPreview) {
    lines.push(`   预览: ${task.resultPreview.slice(0, 100)}...`);
  }
  if (task.outputFile) {
    lines.push(`   完整输出: ${task.outputFile}`);
  }
  return lines.join('\n');
}

// ============ 代理循环 ============

const SYSTEM_PROMPT = `你是一个支持后台任务的 AI 编码助手。

你有以下工具：
- background_run: 在后台启动慢命令（npm install、pytest 等），立刻返回不阻塞
- check_background: 检查后台任务状态
- bash: 同步执行短命令

## 工作方式
1. 对于耗时命令，使用 background_run 启动后台执行
2. 在等待期间可以继续做其他工作
3. 后台任务完成后，你会在消息中收到通知
4. 收到通知后，根据结果决定下一步

注意：你可能在某条消息中看到 [后台通知]，这是后台任务完成的结果。`;

async function agentLoopWithBackground(userInput: string) {
  const outputDir = join(process.cwd(), '.bg-output');
  const bgManager = new BackgroundManager(outputDir);
  await bgManager.init();

  console.log('🤖 启动后台任务代理...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const tools = createBgTools(bgManager);
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userInput },
  ];

  const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));

  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 12;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;

    // 在模型调用前排空通知
    const notifications = bgManager.drainNotifications();
    if (notifications.length > 0) {
      const notifText = notifications
        .map((n) => `[后台通知] 任务 ${n.taskId} ${n.status}: ${n.preview.slice(0, 200)}`)
        .join('\n\n');
      messages.push({ role: 'user', content: notifText });
      console.log(`📬 注入 ${notifications.length} 条后台通知\n`);
    }

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
      // 给后台任务一点时间完成
      await new Promise((r) => setTimeout(r, 1500));
      console.log('🔄 继续处理...\n');
    }
  }

  // 最终状态
  console.log('=== 后台任务统计 ===');
  const allTasks = bgManager.listAll();
  for (const t of allTasks) {
    const icon = { running: '🔄', completed: '✅', failed: '❌' }[t.status];
    console.log(`  ${icon} ${t.id}: ${t.command} → ${t.status}`);
  }
}

// ============ 演示 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 13: Background Tasks 示例 ===\n');

  await agentLoopWithBackground(
    '请帮我同时在后台执行以下操作：\n1. npm install（后台）\n2. npm run build（后台）\n然后在等待期间用 bash 检查一下当前目录。\n最后确认所有后台任务完成。'
  );
}

export { agentLoopWithBackground, BackgroundManager };
export type { RuntimeTaskRecord, Notification };
