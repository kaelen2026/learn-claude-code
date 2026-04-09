/**
 * Stage 14: Scheduled Tasks（定时调度）
 *
 * 让系统能"在未来某个时间自动触发工作"，而非仅能"响应当下"。
 *
 * 三部分架构：
 * 1. 调度记录（ScheduleRecord）— 记住未来何时开工
 * 2. 定时检查器 — 每分钟检查是否匹配
 * 3. 通知队列 — 时间到则注入主循环
 *
 * "定时调度并不是另一套 agent，最终还是回到同一条主循环"
 *
 * Cron 表达式：5 字段格式 → 分 时 日 月 周
 *
 * 学习要点：
 * - Cron 表达式解析
 * - 分钟级定时检查
 * - last_fired_at 防重复触发
 * - 通知队列注入主循环
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '../core/types.js';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

interface ScheduleRecord {
  id: string;
  cron: string;
  prompt: string;
  recurring: boolean;
  createdAt: number;
  lastFiredAt: number | null;
}

interface ScheduleNotification {
  type: 'scheduled_prompt';
  scheduleId: string;
  prompt: string;
}

// ============ Cron 解析器 ============

/**
 * 最小 Cron 解析：5 字段（分 时 日 月 周）
 * 支持：数字、星号、步进、逗号分隔、范围(N-M)
 */
function matchesCron(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay(); // 0=Sunday

  return (
    matchesField(parts[0], minute, 0, 59) &&
    matchesField(parts[1], hour, 0, 23) &&
    matchesField(parts[2], dayOfMonth, 1, 31) &&
    matchesField(parts[3], month, 1, 12) &&
    matchesField(parts[4], dayOfWeek, 0, 6)
  );
}

function matchesField(field: string, value: number, _min: number, _max: number): boolean {
  if (field === '*') return true;

  // */N — 步进
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2));
    return value % step === 0;
  }

  // 逗号分隔
  const parts = field.split(',');
  for (const part of parts) {
    // 范围 N-M
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (value >= start && value <= end) return true;
    } else {
      if (parseInt(part) === value) return true;
    }
  }

  return false;
}

// ============ ScheduleManager ============

class ScheduleManager {
  private schedules = new Map<string, ScheduleRecord>();
  private notifications: ScheduleNotification[] = [];
  private nextId = 1;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /** 创建调度 */
  create(cron: string, prompt: string, recurring = true): ScheduleRecord {
    const id = `job_${String(this.nextId++).padStart(3, '0')}`;
    const record: ScheduleRecord = {
      id,
      cron,
      prompt,
      recurring,
      createdAt: Date.now(),
      lastFiredAt: null,
    };
    this.schedules.set(id, record);
    return record;
  }

  /** 删除调度 */
  delete(id: string): boolean {
    return this.schedules.delete(id);
  }

  /** 列出所有调度 */
  list(): ScheduleRecord[] {
    return Array.from(this.schedules.values());
  }

  /** 检查所有调度，触发到期的任务 */
  check(now = new Date()): ScheduleNotification[] {
    const fired: ScheduleNotification[] = [];
    const currentMinute = Math.floor(now.getTime() / 60000);

    for (const [id, record] of this.schedules) {
      // 防重复：同一分钟不重复触发
      if (record.lastFiredAt) {
        const lastMinute = Math.floor(record.lastFiredAt / 60000);
        if (lastMinute === currentMinute) continue;
      }

      if (matchesCron(record.cron, now)) {
        record.lastFiredAt = now.getTime();

        fired.push({
          type: 'scheduled_prompt',
          scheduleId: id,
          prompt: record.prompt,
        });

        // 非重复任务触发后删除
        if (!record.recurring) {
          this.schedules.delete(id);
        }
      }
    }

    this.notifications.push(...fired);
    return fired;
  }

  /** 排空通知队列 */
  drainNotifications(): ScheduleNotification[] {
    const drained = [...this.notifications];
    this.notifications = [];
    return drained;
  }

  /** 启动定时检查器（每分钟） */
  startChecker() {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
      this.check();
    }, 60_000);
  }

  /** 停止检查器 */
  stopChecker() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// ============ 工具定义 ============

function createScheduleTools(manager: ScheduleManager): Tool[] {
  const cronCreateTool: Tool = {
    name: 'cron_create',
    description: '创建一个定时调度任务。使用 5 字段 cron 表达式（分 时 日 月 周）。',
    input_schema: {
      type: 'object',
      properties: {
        cron: { type: 'string', description: 'Cron 表达式，如 "*/5 * * * *"（每5分钟）、"0 9 * * 1"（每周一9点）' },
        prompt: { type: 'string', description: '到期时要执行的提示/任务' },
        recurring: { type: 'boolean', description: '是否重复执行（默认 true）' },
      },
      required: ['cron', 'prompt'],
    },
    execute: async (params) => {
      const record = manager.create(
        params.cron as string,
        params.prompt as string,
        (params.recurring as boolean) ?? true
      );
      return `调度创建成功:\n${formatSchedule(record)}`;
    },
  };

  const cronDeleteTool: Tool = {
    name: 'cron_delete',
    description: '删除一个定时调度任务',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '调度 ID' },
      },
      required: ['id'],
    },
    execute: async (params) => {
      const deleted = manager.delete(params.id as string);
      return deleted ? `调度 ${params.id} 已删除` : `未找到调度: ${params.id}`;
    },
  };

  const cronListTool: Tool = {
    name: 'cron_list',
    description: '列出所有定时调度任务',
    input_schema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const all = manager.list();
      if (all.length === 0) return '当前没有定时调度任务';
      return `定时调度 (${all.length} 个):\n${all.map(formatSchedule).join('\n---\n')}`;
    },
  };

  return [cronCreateTool, cronDeleteTool, cronListTool];
}

function formatSchedule(record: ScheduleRecord): string {
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

// ============ 代理循环 ============

const SYSTEM_PROMPT = `你是一个支持定时调度的 AI 助手。

你有以下工具：
- cron_create: 创建定时调度（cron 表达式 + 提示文本）
- cron_delete: 删除调度
- cron_list: 列出所有调度

## Cron 表达式格式
5 字段：分 时 日 月 周
- */5 * * * * → 每 5 分钟
- 0 9 * * 1-5 → 工作日每天 9 点
- 30 14 * * * → 每天 14:30
- 0 0 1 * * → 每月 1 号 0 点

## 工作方式
调度创建后，系统会在匹配时间自动触发，将提示注入对话。`;

async function agentLoopWithSchedule(userInput: string) {
  const manager = new ScheduleManager();

  console.log('🤖 启动定时调度代理...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const tools = createScheduleTools(manager);
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
  const maxLoops = 10;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;

    // 模拟时间推进：手动触发一次检查
    const fired = manager.check();
    const notifications = manager.drainNotifications();
    if (notifications.length > 0) {
      const notifText = notifications
        .map((n) => `[定时触发] 调度 ${n.scheduleId}: ${n.prompt}`)
        .join('\n');
      messages.push({ role: 'user', content: notifText });
      console.log(`⏰ 注入 ${notifications.length} 条定时通知\n`);
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
      console.log('🔄 继续处理...\n');
    }
  }

  // 模拟触发演示
  console.log('=== 定时触发模拟演示 ===\n');
  const schedules = manager.list();
  if (schedules.length > 0) {
    // 模拟一个匹配当前时间的触发
    const now = new Date();
    console.log(`当前时间: ${now.toLocaleString('zh-CN')}`);
    const fired2 = manager.check(now);
    console.log(`本轮触发: ${fired2.length} 个\n`);

    for (const s of schedules) {
      const matches = matchesCron(s.cron, now);
      console.log(`  ${matches ? '🔔' : '⏳'} ${s.id} [${s.cron}] → ${matches ? '匹配！' : '未匹配'}`);
    }
  }

  manager.stopChecker();
}

// ============ 独立演示：Cron 解析器 ============

function demoCronParser() {
  console.log('--- Cron 解析器演示 ---\n');

  const now = new Date();
  console.log(`当前时间: ${now.toLocaleString('zh-CN')} (分=${now.getMinutes()}, 时=${now.getHours()}, 周=${now.getDay()})\n`);

  const expressions = [
    { cron: '* * * * *', desc: '每分钟' },
    { cron: '*/5 * * * *', desc: '每 5 分钟' },
    { cron: `${now.getMinutes()} ${now.getHours()} * * *`, desc: '当前这一分钟' },
    { cron: '0 9 * * 1-5', desc: '工作日 9 点' },
    { cron: '30 14 * * *', desc: '每天 14:30' },
    { cron: '0 0 1 * *', desc: '每月 1 号 0 点' },
  ];

  for (const { cron, desc } of expressions) {
    const matches = matchesCron(cron, now);
    console.log(`  ${matches ? '🔔' : '⏳'} [${cron}] ${desc} → ${matches ? '匹配' : '不匹配'}`);
  }
  console.log();
}

// ============ 演示 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 14: Scheduled Tasks 示例 ===\n');

  demoCronParser();

  await agentLoopWithSchedule(
    '请帮我设置以下定时任务：\n1. 每 5 分钟检查一次服务健康状态\n2. 每天早上 9 点生成日报\n3. 每周一 10 点运行全量测试（一次性）\n然后列出所有调度。'
  );
}

export { agentLoopWithSchedule, ScheduleManager, matchesCron };
export type { ScheduleRecord, ScheduleNotification };
