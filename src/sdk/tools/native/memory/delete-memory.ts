import type { MemoryManager } from '../../../capabilities/memory/memory-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createDeleteMemoryTool(manager: MemoryManager): ToolDefinition {
  return {
    name: 'delete_memory',
    description: '删除一条记忆',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: '记忆文件名' },
      },
      required: ['filename'],
    },
    execute: async (input) => {
      const filename = String(input.filename);
      const deleted = await manager.delete(filename);
      return deleted ? `记忆已删除: ${filename}` : `未找到记忆: ${filename}`;
    },
  };
}
