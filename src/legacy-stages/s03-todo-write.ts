/**
 * Stage 03: Todo Write（任务管理）
 *
 * AI 自动生成和管理任务列表：
 * 1. 定义任务 CRUD 工具（创建、列表、更新、删除）
 * 2. 使用内存中的 Map 存储任务
 * 3. Claude 自动将用户请求拆分为任务
 * 4. 追踪任务状态（pending → in_progress → completed）
 *
 * 学习要点：
 * - 任务数据结构（Task interface）
 * - CRUD 操作
 * - 状态管理
 * - AI 驱动的任务规划
 */

import type Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';
import type { Task, Tool } from '../core/types.js';
import { TaskStatus } from '../core/types.js';

const client = createAnthropicClient();

// ============ 任务存储 ============

const taskStore = new Map<string, Task>();
let nextId = 1;

// ============ 工具定义 ============

/**
 * 创建任务
 */
const createTaskTool: Tool = {
  name: 'create_task',
  description: '创建一个新任务，返回任务详情',
  input_schema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: '任务标题（简短描述）',
      },
      description: {
        type: 'string',
        description: '任务详细描述',
      },
    },
    required: ['subject', 'description'],
  },
  execute: async (params) => {
    const id = String(nextId++);
    const now = new Date();
    const task: Task = {
      id,
      subject: params.subject as string,
      description: params.description as string,
      status: TaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };
    taskStore.set(id, task);
    return `任务创建成功:\n${formatTask(task)}`;
  },
};

/**
 * 列出任务
 */
const listTasksTool: Tool = {
  name: 'list_tasks',
  description: '列出所有任务，可按状态过滤',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: '按状态过滤: pending, in_progress, completed, failed（不传则返回全部）',
      },
    },
  },
  execute: async (params) => {
    let tasks = Array.from(taskStore.values());
    if (params.status) {
      tasks = tasks.filter((t) => t.status === params.status);
    }
    if (tasks.length === 0) {
      return '当前没有任务';
    }
    return `任务列表 (${tasks.length} 个):\n${tasks.map(formatTask).join('\n---\n')}`;
  },
};

/**
 * 更新任务
 */
const updateTaskTool: Tool = {
  name: 'update_task',
  description: '更新任务的状态或描述',
  input_schema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: '任务 ID',
      },
      status: {
        type: 'string',
        description: '新状态: pending, in_progress, completed, failed',
      },
      description: {
        type: 'string',
        description: '新的描述内容',
      },
    },
    required: ['id'],
  },
  execute: async (params) => {
    const task = taskStore.get(params.id as string);
    if (!task) {
      return `错误: 任务 ${params.id} 不存在`;
    }
    if (params.status) {
      task.status = params.status as TaskStatus;
    }
    if (params.description) {
      task.description = params.description as string;
    }
    task.updatedAt = new Date();
    return `任务更新成功:\n${formatTask(task)}`;
  },
};

/**
 * 删除任务
 */
const deleteTaskTool: Tool = {
  name: 'delete_task',
  description: '删除一个任务',
  input_schema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: '要删除的任务 ID',
      },
    },
    required: ['id'],
  },
  execute: async (params) => {
    const id = params.id as string;
    if (!taskStore.has(id)) {
      return `错误: 任务 ${id} 不存在`;
    }
    taskStore.delete(id);
    return `任务 ${id} 已删除`;
  },
};

// ============ 辅助函数 ============

function formatTask(task: Task): string {
  const statusIcon: Record<TaskStatus, string> = {
    [TaskStatus.PENDING]: '⏳',
    [TaskStatus.IN_PROGRESS]: '🔄',
    [TaskStatus.COMPLETED]: '✅',
    [TaskStatus.FAILED]: '❌',
  };
  return [
    `${statusIcon[task.status]} [${task.id}] ${task.subject}`,
    `   状态: ${task.status}`,
    `   描述: ${task.description}`,
  ].join('\n');
}

// ============ 代理循环 ============

const tools: Tool[] = [createTaskTool, listTasksTool, updateTaskTool, deleteTaskTool];

const SYSTEM_PROMPT = `你是一个任务管理 AI 助手。当用户提出复杂请求时，你应该：

1. 将请求拆分为多个子任务，使用 create_task 工具逐一创建
2. 使用 list_tasks 查看当前任务状态
3. 开始处理每个任务时，用 update_task 将状态改为 in_progress
4. 完成任务后，用 update_task 将状态改为 completed
5. 最后用 list_tasks 展示最终结果

请主动管理任务状态，展示完整的任务生命周期。`;

async function agentLoopWithTodos(userInput: string) {
  console.log('🤖 启动任务管理代理...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userInput }];

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
          console.log(`✅ 工具结果: ${result}\n`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        } else {
          console.log(`❌ 未找到工具: ${block.name}\n`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `错误: 未找到工具 ${block.name}`,
            is_error: true,
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
      console.log('🔄 继续处理工具调用...\n');
    }
  }

  if (loopCount >= maxLoops) {
    console.log('⚠️  达到最大循环次数\n');
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 03: Todo Write 示例 ===\n');

  await agentLoopWithTodos(
    '请帮我规划搭建一个博客网站，需要：1) 设计页面结构 2) 选择技术栈 3) 部署上线。请用任务工具管理这些步骤。',
  );
}

export { agentLoopWithTodos, taskStore, tools };
