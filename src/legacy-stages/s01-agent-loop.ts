/**
 * Stage 01: Agent Loop（代理循环）
 *
 * 这是最基础的 AI 代理实现：
 * 1. 接收用户输入
 * 2. 发送给 Claude API
 * 3. 获取响应
 * 4. 显示结果
 *
 * 学习要点：
 * - 如何调用 Claude API
 * - 消息格式和对话历史管理
 * - 基础的异步流程控制
 */

import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

/**
 * 简单的代理循环
 */
async function simpleAgentLoop(userInput: string) {
  console.log('🤖 启动代理循环...\n');
  console.log(`👤 用户: ${userInput}\n`);

  // 消息历史
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: userInput,
    },
  ];

  try {
    // 调用 Claude API
    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 1024,
      messages,
    });

    // 提取文本响应
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    console.log(`🤖 Claude: ${textContent}\n`);
    console.log(`📊 使用 tokens: ${response.usage.input_tokens} 输入 + ${response.usage.output_tokens} 输出\n`);

    return textContent;
  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  }
}

/**
 * 多轮对话循环
 */
async function conversationLoop() {
  console.log('🤖 启动多轮对话循环...\n');

  const messages: Anthropic.MessageParam[] = [];

  // 模拟多轮对话
  const userInputs = [
    '你好！我想学习 TypeScript',
    '能给我推荐一些学习资源吗？',
    '谢谢！',
  ];

  for (const input of userInputs) {
    console.log(`👤 用户: ${input}\n`);

    // 添加用户消息
    messages.push({
      role: 'user',
      content: input,
    });

    console.log('⏳ Claude 正在思考...\n');
    console.log(messages);

    // 调用 API
    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 1024,
      messages,
    });

    // 提取响应
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    console.log(`🤖 Claude: ${textContent}\n`);
    console.log('---\n');

    // 添加助手响应到历史
    messages.push({
      role: 'assistant',
      content: response.content,
    });
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 01: Agent Loop 示例 ===\n');

  // 示例 1: 简单单次对话
  await simpleAgentLoop('用一句话解释什么是 TypeScript');

  console.log('\n=== 多轮对话示例 ===\n');

  // 示例 2: 多轮对话
  await conversationLoop();
}

export { simpleAgentLoop, conversationLoop };
