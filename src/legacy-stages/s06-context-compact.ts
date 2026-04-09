/**
 * Stage 06: Context Compact（上下文压缩）
 *
 * 三层压缩模型，管理活跃上下文预算：
 *
 * 第 1 层 - 大结果持久化：超过阈值的工具输出保存到磁盘，上下文中仅保留预览
 * 第 2 层 - 微压缩：旧工具结果替换为占位符，仅保留最近 N 个完整结果
 * 第 3 层 - 完整压缩：历史过长时用 Claude 生成摘要，重启对话连续性
 *
 * 核心思想：保留工作连续性，而非简单删除历史。
 *
 * 学习要点：
 * - 上下文窗口管理策略
 * - 消息摘要与历史压缩
 * - 大输出持久化（磁盘缓存）
 * - 压缩后必须保留：当前任务、关键动作、修改文件、决定约束、下一步行动
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Tool } from '../core/types.js';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

// ============ 配置参数 ============

const CONTEXT_LIMIT = 50_000;         // 上下文字符上限，超过触发完整压缩
const KEEP_RECENT_TOOL_RESULTS = 3;   // 微压缩时保留最近 N 个完整工具结果
const PERSIST_THRESHOLD = 30_000;     // 工具输出超过此字符数则落盘
const PREVIEW_CHARS = 2_000;          // 落盘后保留的预览字符数

// ============ CompactState ============

class CompactState {
  hasCompacted = false;
  lastSummary = '';
  recentFiles: string[] = [];
  persistDir: string;

  constructor(persistDir: string) {
    this.persistDir = persistDir;
  }

  trackFile(path: string) {
    this.recentFiles = [path, ...this.recentFiles.filter((f) => f !== path)].slice(0, 5);
  }
}

// ============ 第 1 层：大结果持久化 ============

/**
 * 超过阈值的工具输出保存到磁盘，返回预览标记
 */
async function persistLargeOutput(
  output: string,
  toolName: string,
  state: CompactState
): Promise<string> {
  if (output.length <= PERSIST_THRESHOLD) {
    return output; // 不需要持久化
  }

  // 保存到磁盘
  await mkdir(state.persistDir, { recursive: true });
  const filename = `${toolName}_${Date.now()}.txt`;
  const filepath = join(state.persistDir, filename);
  await writeFile(filepath, output, 'utf-8');

  state.trackFile(filepath);

  const preview = output.slice(0, PREVIEW_CHARS);
  console.log(`  💾 大结果持久化: ${output.length} 字符 → ${filepath}\n`);

  return `<persisted-output>\nFull output saved to: ${filepath}\nPreview: ${preview}\n</persisted-output>`;
}

// ============ 第 2 层：微压缩 ============

/**
 * 仅保留最近 N 个工具结果完整内容，旧的替换为占位符
 */
function microCompact(messages: Anthropic.MessageParam[]): {
  messages: Anthropic.MessageParam[];
  compacted: number;
} {
  // 找到所有包含 tool_result 的消息索引
  const toolResultIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const hasToolResult = msg.content.some(
        (block) => typeof block === 'object' && 'type' in block && block.type === 'tool_result'
      );
      if (hasToolResult) {
        toolResultIndices.push(i);
      }
    }
  }

  // 如果工具结果不多，无需压缩
  if (toolResultIndices.length <= KEEP_RECENT_TOOL_RESULTS) {
    return { messages, compacted: 0 };
  }

  // 需要压缩的索引（保留最后 N 个）
  const toCompact = toolResultIndices.slice(0, -KEEP_RECENT_TOOL_RESULTS);
  let compactedCount = 0;

  const newMessages = messages.map((msg, i) => {
    if (!toCompact.includes(i)) return msg;

    if (Array.isArray(msg.content)) {
      const newContent = msg.content.map((block) => {
        if (typeof block === 'object' && 'type' in block && block.type === 'tool_result') {
          const tb = block as Anthropic.ToolResultBlockParam;
          const original = typeof tb.content === 'string' ? tb.content : JSON.stringify(tb.content);
          compactedCount++;
          return {
            ...tb,
            content: `[已压缩] 原始输出 ${original.length} 字符`,
          };
        }
        return block;
      });
      return { ...msg, content: newContent } as Anthropic.MessageParam;
    }
    return msg;
  });

  return { messages: newMessages, compacted: compactedCount };
}

// ============ 第 3 层：完整压缩 ============

/**
 * 用 Claude 生成压缩摘要，重启对话连续性
 */
async function summarizeHistory(
  messages: Anthropic.MessageParam[],
  state: CompactState
): Promise<string> {
  // 将消息历史转为文本
  const historyText = messages
    .map((msg) => {
      const role = msg.role === 'user' ? '用户' : '助手';
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content).slice(0, 500);
      return `[${role}] ${content}`;
    })
    .join('\n\n');

  const response = await client.messages.create({
    model: appConfig.model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `请将以下对话历史压缩为一段简洁的摘要。必须保留：
1. 当前任务是什么
2. 已完成的关键动作
3. 修改过的文件
4. 重要的决定和约束
5. 下一步行动计划

对话历史：
${historyText}

请输出压缩摘要：`,
      },
    ],
  });

  const summary = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  return summary;
}

/**
 * 执行完整压缩：生成摘要 → 重建消息历史
 */
async function compactHistory(
  messages: Anthropic.MessageParam[],
  state: CompactState
): Promise<Anthropic.MessageParam[]> {
  console.log('🗜️  触发完整压缩...\n');

  const summary = await summarizeHistory(messages, state);
  state.hasCompacted = true;
  state.lastSummary = summary;

  console.log(`📝 压缩摘要:\n${summary}\n`);

  // 用摘要重启对话
  return [
    {
      role: 'user',
      content: `[上下文已压缩] 以下是之前对话的摘要，请基于此继续工作：\n\n${summary}`,
    },
    {
      role: 'assistant',
      content: '好的，我已了解之前的工作进展。请告诉我接下来需要做什么，或者我继续之前的任务。',
    },
  ];
}

// ============ 辅助函数 ============

/**
 * 估算消息列表的总字符数
 */
function estimateContextSize(messages: Anthropic.MessageParam[]): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);
    return total + content.length;
  }, 0);
}

// ============ 工具定义 ============

/**
 * 模拟一个会产生大量输出的工具（用于演示持久化）
 */
const readLargeFileTool: Tool = {
  name: 'read_large_file',
  description: '读取一个大文件（模拟）。返回大量文本内容，用于演示大结果持久化。',
  input_schema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: '文件名',
      },
    },
    required: ['filename'],
  },
  execute: async (params) => {
    const filename = params.filename as string;
    // 模拟大文件内容
    const lines = Array.from(
      { length: 500 },
      (_, i) => `第 ${i + 1} 行: ${filename} 的内容 — ${'这是一段模拟的大文件数据。'.repeat(5)}`
    );
    return lines.join('\n');
  },
};

/**
 * 模拟一个普通工具
 */
const searchCodeTool: Tool = {
  name: 'search_code',
  description: '搜索代码中的关键字（模拟）',
  input_schema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '搜索关键字',
      },
    },
    required: ['keyword'],
  },
  execute: async (params) => {
    const keyword = params.keyword as string;
    return `找到 3 处匹配 "${keyword}":\n  src/index.ts:15 - const ${keyword} = ...\n  src/utils.ts:42 - function ${keyword}() {...}\n  src/types.ts:8 - interface ${keyword} {...}`;
  },
};

/**
 * 手动触发压缩
 */
const compactTool: Tool = {
  name: 'compact_context',
  description: '手动触发上下文压缩。当你感觉对话过长时使用。',
  input_schema: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return '[compact_requested]'; // 特殊标记，由主循环处理
  },
};

// ============ 代理循环 ============

const tools: Tool[] = [readLargeFileTool, searchCodeTool, compactTool];

const SYSTEM_PROMPT = `你是一个支持上下文压缩的 AI 编码助手。

你有以下工具：
- read_large_file: 读取大文件（可能触发大结果持久化）
- search_code: 搜索代码关键字
- compact_context: 手动触发上下文压缩

为了演示上下文压缩机制，请按用户要求执行多次工具调用。
当你注意到结果被压缩或持久化时，说明发生了什么。`;

async function agentLoopWithCompact(userInput: string) {
  console.log('🤖 启动上下文压缩代理...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const state = new CompactState(join(process.cwd(), '.compact-cache'));

  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userInput },
  ];

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
    const contextSize = estimateContextSize(messages);
    console.log(`🔄 循环 ${loopCount} | 上下文: ${contextSize} 字符 / ${CONTEXT_LIMIT} 上限\n`);

    // 检查是否需要完整压缩（第 3 层）
    if (contextSize > CONTEXT_LIMIT) {
      messages = await compactHistory(messages, state);
      console.log(`🗜️  压缩完成，上下文: ${estimateContextSize(messages)} 字符\n`);
    }

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
    let compactRequested = false;

    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`🤖 Claude: ${block.text}\n`);
      } else if (block.type === 'tool_use') {
        console.log(`🔧 调用工具: ${block.name}`);
        console.log(`📝 参数:`, JSON.stringify(block.input, null, 2), '\n');

        const tool = tools.find((t) => t.name === block.name);
        if (tool) {
          let result = await tool.execute(block.input as Record<string, unknown>);

          // 检查是否请求手动压缩
          if (result === '[compact_requested]') {
            compactRequested = true;
            result = '上下文压缩已触发，将在下一轮执行。';
          }

          // 第 1 层：大结果持久化
          result = await persistLargeOutput(result, block.name, state);

          console.log(`✅ 结果: ${result.slice(0, 150)}${result.length > 150 ? '...' : ''}\n`);
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

    // 第 2 层：微压缩（每轮都执行）
    const { messages: compactedMessages, compacted } = microCompact(messages);
    if (compacted > 0) {
      messages = compactedMessages;
      console.log(`🔬 微压缩: ${compacted} 个旧工具结果已替换为占位符\n`);
    }

    // 手动压缩请求
    if (compactRequested) {
      messages = await compactHistory(messages, state);
      console.log(`🗜️  手动压缩完成，上下文: ${estimateContextSize(messages)} 字符\n`);
    }

    if (response.stop_reason === 'end_turn') {
      continueLoop = false;
      console.log('✅ 对话结束\n');
    } else if (response.stop_reason === 'tool_use') {
      continueLoop = true;
      console.log('🔄 继续处理...\n');
    }
  }

  // 输出压缩统计
  console.log('=== 压缩统计 ===');
  console.log(`总循环数: ${loopCount}`);
  console.log(`是否触发过完整压缩: ${state.hasCompacted ? '是' : '否'}`);
  console.log(`最终上下文大小: ${estimateContextSize(messages)} 字符`);
  console.log(`最近访问文件: ${state.recentFiles.length > 0 ? state.recentFiles.join(', ') : '无'}`);
  if (state.lastSummary) {
    console.log(`最后摘要: ${state.lastSummary.slice(0, 200)}...`);
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 06: Context Compact 示例 ===\n');

  await agentLoopWithCompact(
    '请帮我做以下操作来演示上下文压缩：\n1. 搜索 "handleRequest" 关键字\n2. 读取大文件 server.log\n3. 搜索 "parseConfig" 关键字\n4. 再读取大文件 database.log\n5. 搜索 "validateInput" 关键字\n最后总结你的发现。'
  );
}

export { agentLoopWithCompact, CompactState, microCompact, compactHistory, estimateContextSize };
