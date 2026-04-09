import type { ToolDefinition } from '../../../shared/types.js';
import type { MemoryManager } from '../../../capabilities/memory/memory-manager.js';

export function createSaveMemoryTool(manager: MemoryManager): ToolDefinition {
  return {
    name: 'save_memory',
    description: '保存一条跨会话记忆（用户偏好、反馈、项目决策、外部资源）',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '记忆名称' },
        description: { type: 'string', description: '简短描述' },
        type: { type: 'string', description: '记忆类型: user, feedback, project, reference' },
        body: { type: 'string', description: '记忆正文' },
      },
      required: ['name', 'description', 'type', 'body'],
    },
    execute: async (input) => {
      const entry = await manager.save({
        name: String(input.name),
        description: String(input.description),
        type: String(input.type) as 'user' | 'feedback' | 'project' | 'reference',
        body: String(input.body),
      });
      return `记忆已保存: ${entry.filename}`;
    },
  };
}
