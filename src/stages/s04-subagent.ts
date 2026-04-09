/**
 * Stage 04: Subagent（子代理）
 *
 * 主代理可以创建子代理来并行处理子任务：
 * 1. 主代理接收用户请求，决定是否需要子代理
 * 2. 通过 spawn_subagent 工具创建独立的子代理
 * 3. 每个子代理有自己的对话上下文，独立运行
 * 4. 子代理结果聚合回主代理
 * 5. 多个子代理可并行执行（Promise.all）
 *
 * 学习要点：
 * - 递归代理调用
 * - Promise 并发控制
 * - 父子通信协议
 * - 上下文隔离
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '../core/types.js';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

// ============ 子代理结果存储 ============

interface SubagentResult {
  id: number;
  task: string;
  result: string;
  duration: number;
}

const results: SubagentResult[] = [];
let nextResultId = 1;

// ============ 子代理运行器 ============

/**
 * 运行一个独立的子代理
 * 每个子代理有自己的消息历史，独立与 Claude API 对话
 */
async function runSubagent(task: string, context: string): Promise<string> {
  const agentId = nextResultId;
  console.log(`\n  🤖 子代理 #${agentId} 启动: ${task}`);

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: context
        ? `背景信息: ${context}\n\n任务: ${task}`
        : task,
    },
  ];

  const startTime = Date.now();
  let loopCount = 0;
  const maxLoops = 3;
  let finalText = '';

  while (loopCount < maxLoops) {
    loopCount++;

    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 2048,
      system: '你是一个专注的研究助手。请直接、简洁地回答问题，控制在 200 字以内。',
      messages,
    });

    // 提取文本响应
    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
      }
    }

    // 子代理不使用工具，直接结束
    if (response.stop_reason === 'end_turn') {
      break;
    }
  }

  const duration = Date.now() - startTime;
  console.log(`  ✅ 子代理 #${agentId} 完成 (${duration}ms)\n`);

  return finalText || '子代理未返回结果';
}

// ============ 主代理工具定义 ============

/**
 * 生成子代理工具 - 创建一个子代理来处理子任务
 */
const spawnSubagentTool: Tool = {
  name: 'spawn_subagent',
  description: '创建一个子代理来处理特定的子任务。子代理有独立的上下文，专注完成指定任务后返回结果。',
  input_schema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: '子代理需要完成的具体任务',
      },
      context: {
        type: 'string',
        description: '提供给子代理的背景信息（可选）',
      },
    },
    required: ['task'],
  },
  execute: async (params) => {
    const task = params.task as string;
    const context = (params.context as string) || '';

    const result = await runSubagent(task, context);
    const id = nextResultId++;
    const duration = 0; // 已在 runSubagent 中打印

    results.push({ id, task, result, duration });

    return `子代理 #${id} 完成任务: "${task}"\n\n结果:\n${result}`;
  },
};

/**
 * 列出所有子代理结果
 */
const listResultsTool: Tool = {
  name: 'list_results',
  description: '列出所有已完成的子代理结果',
  input_schema: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    if (results.length === 0) {
      return '暂无子代理结果';
    }
    return results
      .map(
        (r) =>
          `📋 子代理 #${r.id}\n   任务: ${r.task}\n   结果: ${r.result.slice(0, 200)}${r.result.length > 200 ? '...' : ''}`
      )
      .join('\n---\n');
  },
};

// ============ 主代理循环 ============

const tools: Tool[] = [spawnSubagentTool, listResultsTool];

const SYSTEM_PROMPT = `你是一个主代理（orchestrator），可以创建子代理来并行处理子任务。

当用户提出需要多方面研究或分析的请求时：
1. 分析请求，识别可以并行处理的子任务
2. 使用 spawn_subagent 为每个子任务创建一个子代理
3. 等待所有子代理完成后，用 list_results 查看结果
4. 综合所有子代理的结果，给出最终回答

重要：尽量在一次响应中调用多个 spawn_subagent，这样子代理可以并行运行。`;

async function agentLoopWithSubagents(userInput: string) {
  console.log('🤖 启动主代理（支持子代理）...\n');
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
    console.log(`🔄 主代理循环 ${loopCount}...\n`);

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

    // 收集所有工具调用
    const toolCalls: Array<{ block: Anthropic.ToolUseBlock; tool: Tool }> = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`🤖 主代理: ${block.text}\n`);
      } else if (block.type === 'tool_use') {
        const tool = tools.find((t) => t.name === block.name);
        if (tool) {
          toolCalls.push({ block, tool });
        } else {
          console.log(`❌ 未找到工具: ${block.name}\n`);
        }
      }
    }

    // 并行执行所有工具调用（关键：子代理并发）
    if (toolCalls.length > 0) {
      console.log(`⚡ 并行执行 ${toolCalls.length} 个工具调用...\n`);

      const toolResultPromises = toolCalls.map(async ({ block, tool }) => {
        console.log(`🔧 调用工具: ${block.name}`);
        console.log(`📝 参数:`, JSON.stringify(block.input, null, 2));

        const result = await tool.execute(block.input as Record<string, unknown>);
        console.log(`✅ 工具结果: ${result.slice(0, 100)}${result.length > 100 ? '...' : ''}\n`);

        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: result,
        };
      });

      const toolResults = await Promise.all(toolResultPromises);
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

  if (loopCount >= maxLoops) {
    console.log('⚠️  达到最大循环次数\n');
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 04: Subagent 示例 ===\n');

  await agentLoopWithSubagents(
    '请分别研究 React、Vue 和 Svelte 这三个前端框架的优缺点，然后给我一个对比总结。'
  );
}

export { agentLoopWithSubagents, runSubagent, tools };
