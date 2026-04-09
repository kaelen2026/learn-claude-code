/**
 * Stage 11: Error Recovery（错误恢复）
 *
 * 将 Agent 从"遇错即停"升级为"先判断错误类型，再选择恢复路径"。
 * 错误不是例外，而是主循环必须预留的一条正常分支。
 *
 * 三类问题与恢复路径：
 *
 * LLM call → stop_reason 检查
 *   ├─ max_tokens → 注入续写提示 → 重试
 *   ├─ prompt too long → 压缩历史 → 重试
 *   └─ transient error → 指数退避 → 重试
 *
 * 恢复本质是状态机切换：正常执行 → 续写/压缩/退避 → 最终失败
 *
 * 学习要点：
 * - 错误分类与恢复策略
 * - 指数退避算法
 * - 恢复预算管理（防无限循环）
 * - 续写提示设计
 */

import type Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';
import type { Tool } from '../core/types.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

interface RecoveryState {
  continuationAttempts: number;
  compactAttempts: number;
  transportAttempts: number;
}

interface RecoveryDecision {
  kind: 'continue' | 'compact' | 'backoff' | 'fail';
  reason: string;
}

const MAX_CONTINUATION = 3;
const MAX_COMPACT = 2;
const MAX_TRANSPORT_RETRY = 3;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

// ============ 恢复选择器 ============

/**
 * 根据错误类型选择恢复路径
 */
function selectRecovery(
  error: { stopReason?: string; errorMessage?: string },
  state: RecoveryState,
): RecoveryDecision {
  // 路径 1：输出被截断（max_tokens）
  if (error.stopReason === 'max_tokens') {
    if (state.continuationAttempts >= MAX_CONTINUATION) {
      return { kind: 'fail', reason: `续写次数已达上限 (${MAX_CONTINUATION})` };
    }
    return { kind: 'continue', reason: '输出被截断 (max_tokens)，注入续写提示' };
  }

  // 路径 2：上下文过长
  const msg = (error.errorMessage || '').toLowerCase();
  if (
    (msg.includes('prompt') && msg.includes('long')) ||
    msg.includes('context_length') ||
    msg.includes('too many tokens')
  ) {
    if (state.compactAttempts >= MAX_COMPACT) {
      return { kind: 'fail', reason: `压缩次数已达上限 (${MAX_COMPACT})` };
    }
    return { kind: 'compact', reason: '上下文过长，需要压缩历史' };
  }

  // 路径 3：临时连接问题
  if (
    msg.includes('timeout') ||
    msg.includes('rate') ||
    msg.includes('connection') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('overloaded')
  ) {
    if (state.transportAttempts >= MAX_TRANSPORT_RETRY) {
      return { kind: 'fail', reason: `重试次数已达上限 (${MAX_TRANSPORT_RETRY})` };
    }
    return { kind: 'backoff', reason: `临时错误，指数退避重试` };
  }

  // 无法识别的错误
  return {
    kind: 'fail',
    reason: `无法恢复的错误: ${error.errorMessage || error.stopReason || '未知'}`,
  };
}

// ============ 恢复操作 ============

/**
 * 续写恢复：注入续写提示
 */
function injectContinuation(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return [
    ...messages,
    {
      role: 'user',
      content: '你的输出被截断了。请继续直接从停止处接着写，不要重复已输出的内容，不要重新总结。',
    },
  ];
}

/**
 * 压缩恢复：用 Claude 生成摘要，重建上下文
 */
async function compactForRecovery(
  messages: Anthropic.MessageParam[],
): Promise<Anthropic.MessageParam[]> {
  console.log('  🗜️  执行压缩恢复...');

  const historyText = messages
    .map((msg) => {
      const role = msg.role === 'user' ? '用户' : '助手';
      const content =
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content).slice(0, 300);
      return `[${role}] ${content}`;
    })
    .join('\n');

  const response = await client.messages.create({
    model: appConfig.model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `将以下对话压缩为摘要，保留：\n1. 任务概览与成功标准\n2. 已完成工作与涉及文件\n3. 关键决定与失败尝试\n4. 剩余步骤\n\n${historyText}\n\n输出压缩摘要：`,
      },
    ],
  });

  const summary = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  console.log(`  📝 压缩完成 (${summary.length} 字符)\n`);

  return [
    {
      role: 'user',
      content: `[上下文因过长已压缩] 以下是之前的工作摘要，请基于此继续：\n\n${summary}`,
    },
    {
      role: 'assistant',
      content: '好的，我已了解之前的进展，继续工作。',
    },
  ];
}

/**
 * 退避重试：指数退避 + 随机抖动
 */
async function backoff(attempt: number): Promise<void> {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 1000;
  console.log(`  ⏳ 退避等待 ${Math.round(delay)}ms (第 ${attempt + 1} 次重试)...\n`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

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
    return `[模拟] 文件 ${params.path} 内容:\nconst server = http.createServer();\nserver.listen(3000);`;
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
    return `[模拟] 已写入: ${params.path}`;
  },
};

// ============ 带错误恢复的代理循环 ============

const tools: Tool[] = [readFileTool, writeFileTool];

const SYSTEM_PROMPT = `你是一个具备错误恢复能力的 AI 编码助手。

你有以下工具：
- read_file: 读取文件
- write_file: 写入文件

请按用户要求执行操作。如果你的输出被截断，你会收到续写提示。`;

async function agentLoopWithRecovery(userInput: string) {
  console.log('🤖 启动带错误恢复的代理...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const state: RecoveryState = {
    continuationAttempts: 0,
    compactAttempts: 0,
    transportAttempts: 0,
  };

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: userInput }];

  const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));

  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 20;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    console.log(`🔄 循环 ${loopCount}...\n`);

    let response: Anthropic.Message;

    try {
      response = await client.messages.create({
        model: appConfig.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools: anthropicTools,
      });
    } catch (error) {
      // 捕获 API 错误
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ API 错误: ${errorMsg}\n`);

      const decision = selectRecovery({ errorMessage: errorMsg }, state);
      console.log(`  🔀 恢复决策: [${decision.kind}] ${decision.reason}\n`);

      if (decision.kind === 'backoff') {
        await backoff(state.transportAttempts);
        state.transportAttempts++;
        continue;
      } else if (decision.kind === 'compact') {
        messages = await compactForRecovery(messages);
        state.compactAttempts++;
        continue;
      } else {
        console.log(`  💀 无法恢复: ${decision.reason}\n`);
        break;
      }
    }

    // 重置传输重试计数（成功调用）
    state.transportAttempts = 0;

    console.log(`📊 Stop reason: ${response.stop_reason}\n`);

    // 检查是否需要续写恢复
    if (response.stop_reason === 'max_tokens') {
      const decision = selectRecovery({ stopReason: 'max_tokens' }, state);
      console.log(`  🔀 恢复决策: [${decision.kind}] ${decision.reason}\n`);

      if (decision.kind === 'continue') {
        // 先添加被截断的响应
        messages.push({ role: 'assistant', content: response.content });

        // 提取已输出的文本
        for (const block of response.content) {
          if (block.type === 'text') {
            console.log(`🤖 Claude (截断): ${block.text.slice(0, 200)}...\n`);
          }
        }

        messages = injectContinuation(messages);
        state.continuationAttempts++;
        console.log(`  📎 已注入续写提示 (第 ${state.continuationAttempts} 次)\n`);
        continue;
      } else {
        console.log(`  💀 ${decision.reason}\n`);
        break;
      }
    }

    // 正常处理
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

  // 恢复统计
  console.log('=== 错误恢复统计 ===');
  console.log(`总循环数: ${loopCount}`);
  console.log(`续写恢复: ${state.continuationAttempts}/${MAX_CONTINUATION}`);
  console.log(`压缩恢复: ${state.compactAttempts}/${MAX_COMPACT}`);
  console.log(`退避重试: ${state.transportAttempts}/${MAX_TRANSPORT_RETRY}`);
}

// ============ 独立演示：恢复选择器 ============

function demoRecoverySelector() {
  console.log('--- 恢复选择器演示 ---\n');

  const state: RecoveryState = {
    continuationAttempts: 0,
    compactAttempts: 0,
    transportAttempts: 0,
  };

  const scenarios = [
    { error: { stopReason: 'max_tokens' }, label: '输出截断 (max_tokens)' },
    { error: { errorMessage: 'prompt is too long for this model' }, label: '上下文过长' },
    { error: { errorMessage: 'connection timeout after 30s' }, label: '连接超时' },
    { error: { errorMessage: '429 rate limit exceeded' }, label: '限流 (429)' },
    { error: { errorMessage: '503 service overloaded' }, label: '服务过载 (503)' },
    { error: { errorMessage: 'unknown fatal error' }, label: '未知错误' },
  ];

  for (const { error, label } of scenarios) {
    const decision = selectRecovery(error, state);
    const icon = { continue: '📎', compact: '🗜️', backoff: '⏳', fail: '💀' }[decision.kind];
    console.log(`  ${icon} ${label} → [${decision.kind}] ${decision.reason}`);
  }
  console.log();
}

// ============ 演示 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 11: Error Recovery 示例 ===\n');

  // 先演示恢复选择器
  demoRecoverySelector();

  // 再运行代理循环
  await agentLoopWithRecovery(
    '请读取 src/server.ts 文件，分析其中的路由结构，然后写一个新的路由处理函数到 src/routes.ts。',
  );
}

export type { RecoveryDecision, RecoveryState };
export { agentLoopWithRecovery, backoff, selectRecovery };
