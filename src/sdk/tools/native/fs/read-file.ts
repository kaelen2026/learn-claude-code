import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { ToolDefinition } from '../../../shared/types.js';

export function createReadFileTool(): ToolDefinition {
  return {
    name: 'read_file',
    description: '读取指定文件内容',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
      },
      required: ['path'],
    },
    execute: async (input) => {
      const path = String(input.path || '');
      if (!existsSync(path)) {
        return `文件不存在: ${path}`;
      }

      const content = await readFile(path, 'utf-8');
      return content.slice(0, 4000);
    },
  };
}
