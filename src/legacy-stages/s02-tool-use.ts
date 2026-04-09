/**
 * Stage 02: Tool Use（工具使用）
 *
 * 让 AI 能够调用工具来执行实际操作：
 * 1. 定义工具（读文件、写文件、执行命令等）
 * 2. 将工具描述发送给 Claude
 * 3. Claude 决定何时调用哪个工具
 * 4. 执行工具并返回结果
 * 5. 继续对话循环
 *
 * 学习要点：
 * - 工具定义和注册
 * - Tool use API 的使用
 * - 工具调用循环（可能需要多次调用）
 */

import type Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';
import type { Tool } from '../core/types.js';

const client = createAnthropicClient();

/**
 * 工具定义：读取文件
 */
const readFileTool: Tool = {
  name: 'read_file',
  description: '读取指定路径的文件内容',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径',
      },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const path = params.path as string;
    try {
      if (!existsSync(path)) {
        return `错误: 文件 ${path} 不存在`;
      }
      const content = await readFile(path, 'utf-8');
      return `文件内容:\n${content}`;
    } catch (error) {
      return `读取文件失败: ${error}`;
    }
  },
};

/**
 * 工具定义：写入文件
 */
const writeFileTool: Tool = {
  name: 'write_file',
  description: '将内容写入指定路径的文件',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径',
      },
      content: {
        type: 'string',
        description: '要写入的内容',
      },
    },
    required: ['path', 'content'],
  },
  execute: async (params) => {
    const path = params.path as string;
    const content = params.content as string;
    try {
      await writeFile(path, content, 'utf-8');
      return `成功写入文件: ${path}`;
    } catch (error) {
      return `写入文件失败: ${error}`;
    }
  },
};

/**
 * 工具注册表
 */
const tools: Tool[] = [readFileTool, writeFileTool];

/**
 * 带工具使用的代理循环
 */
async function agentLoopWithTools(userInput: string) {
  console.log('🤖 启动带工具的代理循环...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: userInput,
    },
  ];

  // 转换工具格式为 Anthropic API 格式
  const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));

  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 10; // 防止无限循环

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    console.log(`🔄 循环 ${loopCount}...\n`);

    // 调用 Claude API
    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 2048,
      messages,
      tools: anthropicTools,
    });

    console.log(`📊 Stop reason: ${response.stop_reason}\n`);

    // 先将 assistant 的响应添加到历史
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    // 收集所有工具结果
    const toolResults: Anthropic.MessageParam[] = [];

    // 处理响应内容
    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`🤖 Claude: ${block.text}\n`);
      } else if (block.type === 'tool_use') {
        console.log(`🔧 调用工具: ${block.name}`);
        console.log(`📝 参数:`, JSON.stringify(block.input, null, 2), '\n');

        // 查找并执行工具
        const tool = tools.find((t) => t.name === block.name);
        if (tool) {
          const result = await tool.execute(block.input as Record<string, unknown>);
          console.log(`✅ 工具结果: ${result}\n`);

          // 收集工具结果
          toolResults.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              },
            ],
          });
        } else {
          console.log(`❌ 未找到工具: ${block.name}\n`);
        }
      }
    }

    // 如果有工具结果，添加到消息历史
    if (toolResults.length > 0) {
      // 合并所有工具结果到一条消息
      const allToolResults = toolResults.flatMap(
        (msg) => msg.content as Anthropic.ToolResultBlockParam[],
      );
      messages.push({
        role: 'user',
        content: allToolResults,
      });
    }

    // 检查是否需要继续循环
    if (response.stop_reason === 'end_turn') {
      continueLoop = false;
      console.log('✅ 对话结束\n');
    } else if (response.stop_reason === 'tool_use') {
      continueLoop = true;
      console.log('🔄 继续处理工具调用...\n');
    }
  }

  if (loopCount >= maxLoops) {
    console.log('⚠️  达到最大循环次数\n');
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 02: Tool Use 示例 ===\n');

  await agentLoopWithTools(
    '请创建一个名为 test.txt 的文件，内容是 "Hello from Claude!"，然后读取这个文件确认内容',
  );
}

export { agentLoopWithTools, tools };
