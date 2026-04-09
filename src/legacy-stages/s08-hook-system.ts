/**
 * Stage 08: Hook System（钩子系统）
 *
 * Hook 让系统围绕主循环生长，而不是不断重写主循环本身。
 *
 * 三个核心事件：
 * - SessionStart: 会话初始化时触发（欢迎信息、环境检查）
 * - PreToolUse: 工具执行前触发（可阻止执行或注入警告）
 * - PostToolUse: 工具执行后触发（审计日志、补充上下文）
 *
 * 统一退出码约定：
 * - 0: 继续正常执行
 * - 1: 阻止当前操作
 * - 2: 注入补充消息后继续
 *
 * 学习要点：
 * - 事件驱动架构
 * - 钩子注册与生命周期管理
 * - 退出码约定
 * - 关注点分离（主循环 vs 扩展逻辑）
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '../core/types.js';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

type HookEventName = 'SessionStart' | 'PreToolUse' | 'PostToolUse';

interface HookEvent {
  name: HookEventName;
  payload: Record<string, unknown>;
}

interface HookResult {
  exitCode: 0 | 1 | 2;  // 0=继续, 1=阻止, 2=注入消息后继续
  message: string;
}

/** 钩子处理函数类型 */
type HookHandler = (event: HookEvent) => Promise<HookResult>;

/** 钩子配置（从 .hooks.json 加载） */
interface HookConfig {
  event: HookEventName;
  name: string;
  description: string;
}

// ============ HookRunner ============

class HookRunner {
  private hooks = new Map<HookEventName, Array<{ name: string; handler: HookHandler }>>();

  /** 注册钩子 */
  register(event: HookEventName, name: string, handler: HookHandler) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push({ name, handler });
  }

  /** 执行指定事件的所有钩子 */
  async run(event: HookEvent): Promise<HookResult[]> {
    const handlers = this.hooks.get(event.name) || [];
    if (handlers.length === 0) return [];

    const results: HookResult[] = [];
    for (const { name, handler } of handlers) {
      try {
        const result = await Promise.race([
          handler(event),
          new Promise<HookResult>((_, reject) =>
            setTimeout(() => reject(new Error('Hook timeout')), 30_000)
          ),
        ]);
        console.log(`  🪝 [${event.name}] ${name} → 退出码 ${result.exitCode}${result.message ? ': ' + result.message : ''}`);
        results.push(result);
      } catch (error) {
        console.log(`  ❌ [${event.name}] ${name} 执行失败: ${error}`);
        results.push({ exitCode: 0, message: '' }); // 失败时不阻塞
      }
    }
    return results;
  }

  /** 聚合多个钩子结果：取最严格的退出码 */
  aggregate(results: HookResult[]): HookResult {
    if (results.length === 0) return { exitCode: 0, message: '' };

    // 优先级：1(阻止) > 2(注入) > 0(继续)
    const blocked = results.find((r) => r.exitCode === 1);
    if (blocked) return blocked;

    const injected = results.filter((r) => r.exitCode === 2);
    if (injected.length > 0) {
      return {
        exitCode: 2,
        message: injected.map((r) => r.message).join('\n'),
      };
    }

    return { exitCode: 0, message: '' };
  }

  /** 列出已注册的钩子 */
  list(): Array<{ event: HookEventName; name: string }> {
    const result: Array<{ event: HookEventName; name: string }> = [];
    for (const [event, handlers] of this.hooks) {
      for (const { name } of handlers) {
        result.push({ event, name });
      }
    }
    return result;
  }
}

// ============ 示例钩子 ============

/** SessionStart: 欢迎信息 + 环境检查 */
const welcomeHook: HookHandler = async () => {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  return {
    exitCode: 2,
    message: `🎉 会话已启动 | 时间: ${now} | 环境: development`,
  };
};

/** PreToolUse: 阻止写入敏感文件 */
const sensitiveFileGuard: HookHandler = async (event) => {
  if (event.name !== 'PreToolUse') return { exitCode: 0, message: '' };

  const toolName = event.payload.tool_name as string;
  const input = event.payload.input as Record<string, unknown>;

  if (toolName === 'write_file') {
    const path = (input.path || '') as string;
    const sensitivePatterns = ['.env', 'credentials', 'secret', 'private_key'];
    for (const pattern of sensitivePatterns) {
      if (path.toLowerCase().includes(pattern)) {
        return {
          exitCode: 1,
          message: `⛔ 阻止写入敏感文件: ${path} (匹配: ${pattern})`,
        };
      }
    }
  }

  if (toolName === 'run_command') {
    const command = (input.command || '') as string;
    if (command.includes('sudo') || command.includes('rm -rf')) {
      return {
        exitCode: 1,
        message: `⛔ 阻止危险命令: ${command}`,
      };
    }
  }

  return { exitCode: 0, message: '' };
};

/** PreToolUse: 对写操作注入警告 */
const writeWarningHook: HookHandler = async (event) => {
  if (event.name !== 'PreToolUse') return { exitCode: 0, message: '' };

  const toolName = event.payload.tool_name as string;
  if (toolName === 'write_file' || toolName === 'run_command') {
    return {
      exitCode: 2,
      message: `⚠️ 注意：即将执行写操作 (${toolName})`,
    };
  }

  return { exitCode: 0, message: '' };
};

/** PostToolUse: 审计日志 */
const auditLogHook: HookHandler = async (event) => {
  if (event.name !== 'PostToolUse') return { exitCode: 0, message: '' };

  const toolName = event.payload.tool_name as string;
  const duration = event.payload.duration_ms as number;
  const success = event.payload.success as boolean;

  const status = success ? '✅' : '❌';
  console.log(`  📋 审计日志: ${status} ${toolName} (${duration}ms)`);

  return { exitCode: 0, message: '' };
};

// ============ 工具定义 ============

const readFileTool: Tool = {
  name: 'read_file',
  description: '读取文件内容',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    return `[模拟] 文件 ${params.path} 的内容:\nimport express from 'express';\nconst app = express();`;
  },
};

const writeFileTool: Tool = {
  name: 'write_file',
  description: '写入文件内容',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      content: { type: 'string', description: '写入内容' },
    },
    required: ['path', 'content'],
  },
  execute: async (params) => {
    return `[模拟] 已写入文件: ${params.path} (${(params.content as string).length} 字符)`;
  },
};

const runCommandTool: Tool = {
  name: 'run_command',
  description: '执行 shell 命令',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell 命令' },
    },
    required: ['command'],
  },
  execute: async (params) => {
    return `[模拟] $ ${params.command}\n(ok)`;
  },
};

// ============ 带钩子的代理循环 ============

const tools: Tool[] = [readFileTool, writeFileTool, runCommandTool];

const SYSTEM_PROMPT = `你是一个受钩子系统保护的 AI 编码助手。

你有以下工具：
- read_file: 读取文件
- write_file: 写入文件
- run_command: 执行命令

请按用户要求执行操作。某些操作可能会被钩子拦截或注入额外信息。`;

async function agentLoopWithHooks(userInput: string) {
  // 初始化钩子系统
  const hookRunner = new HookRunner();
  hookRunner.register('SessionStart', 'welcome', welcomeHook);
  hookRunner.register('PreToolUse', 'sensitive-file-guard', sensitiveFileGuard);
  hookRunner.register('PreToolUse', 'write-warning', writeWarningHook);
  hookRunner.register('PostToolUse', 'audit-log', auditLogHook);

  console.log('🤖 启动带钩子系统的代理...\n');

  // 显示已注册钩子
  const registered = hookRunner.list();
  console.log(`🪝 已注册 ${registered.length} 个钩子:`);
  for (const { event, name } of registered) {
    console.log(`   [${event}] ${name}`);
  }
  console.log();

  // 触发 SessionStart
  console.log('--- SessionStart ---');
  const startResults = await hookRunner.run({
    name: 'SessionStart',
    payload: {},
  });
  const startAgg = hookRunner.aggregate(startResults);
  if (startAgg.message) {
    console.log(`  ${startAgg.message}\n`);
  }

  console.log(`👤 用户: ${userInput}\n`);

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
        console.log(`📝 参数:`, JSON.stringify(block.input, null, 2));

        const input = block.input as Record<string, unknown>;

        // --- PreToolUse 钩子 ---
        console.log(`\n  --- PreToolUse ---`);
        const preResults = await hookRunner.run({
          name: 'PreToolUse',
          payload: { tool_name: block.name, input },
        });
        const preAgg = hookRunner.aggregate(preResults);

        if (preAgg.exitCode === 1) {
          // 被阻止
          console.log(`  ${preAgg.message}\n`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: preAgg.message,
            is_error: true,
          });
          continue;
        }

        if (preAgg.exitCode === 2 && preAgg.message) {
          console.log(`  ${preAgg.message}`);
        }

        // --- 执行工具 ---
        const tool = tools.find((t) => t.name === block.name);
        const startTime = Date.now();
        let result: string;
        let success = true;

        if (tool) {
          try {
            result = await tool.execute(input);
          } catch (error) {
            result = `执行失败: ${error}`;
            success = false;
          }
        } else {
          result = `未找到工具: ${block.name}`;
          success = false;
        }

        const duration = Date.now() - startTime;
        console.log(`  📤 结果: ${result}\n`);

        // --- PostToolUse 钩子 ---
        console.log(`  --- PostToolUse ---`);
        await hookRunner.run({
          name: 'PostToolUse',
          payload: {
            tool_name: block.name,
            input,
            output: result,
            success,
            duration_ms: duration,
          },
        });
        console.log();

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
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
}

// ============ 演示 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 08: Hook System 示例 ===\n');

  await agentLoopWithHooks(
    '请帮我完成以下操作：\n1. 读取 src/index.ts\n2. 创建 src/helper.ts 文件\n3. 尝试写入 .env.local 文件\n4. 执行 npm test 命令'
  );
}

export { agentLoopWithHooks, HookRunner };
export type { HookEvent, HookResult, HookHandler, HookEventName };
