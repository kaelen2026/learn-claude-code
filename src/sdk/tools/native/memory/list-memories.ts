import type { ToolDefinition } from '../../../shared/types.js';
import type { MemoryManager } from '../../../capabilities/memory/memory-manager.js';

export function createListMemoriesTool(manager: MemoryManager): ToolDefinition {
  return {
    name: 'list_memories',
    description: '列出所有已保存的记忆，可按类型过滤',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: '可选过滤类型: user, feedback, project, reference' },
      },
    },
    execute: async (input) => {
      const rawType = input.type;
      const entries = await manager.listAll(
        rawType ? (String(rawType) as 'user' | 'feedback' | 'project' | 'reference') : undefined
      );
      if (entries.length === 0) return '当前没有存储的记忆';
      return entries
        .map((entry) => `📝 [${entry.type}] ${entry.name} (${entry.filename})\n   ${entry.description}`)
        .join('\n');
    },
  };
}
