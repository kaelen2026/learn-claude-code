import type { MemoryManager } from '../../../capabilities/memory/memory-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createSearchMemoryTool(manager: MemoryManager): ToolDefinition {
  return {
    name: 'search_memory',
    description: '按关键字搜索已保存的记忆',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键字' },
      },
      required: ['query'],
    },
    execute: async (input) => {
      const query = String(input.query);
      const results = await manager.search(query);
      if (results.length === 0) return `未找到匹配 "${query}" 的记忆`;
      return results
        .map(
          (entry) =>
            `[${entry.type}] ${entry.name}\n  ${entry.description}\n  ${entry.body.slice(0, 200)}`,
        )
        .join('\n---\n');
    },
  };
}
