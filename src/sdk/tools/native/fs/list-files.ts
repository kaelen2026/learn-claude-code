import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { ToolDefinition } from '../../../shared/types.js';

export function createListFilesTool(workspaceRoot: string): ToolDefinition {
  return {
    name: 'list_files',
    description: '列出指定目录下的文件和子目录',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径，默认当前工作目录' },
      },
    },
    execute: async (input) => {
      const path = String(input.path || workspaceRoot);
      if (!existsSync(path)) {
        return `目录不存在: ${path}`;
      }

      const entries = await readdir(path, { withFileTypes: true });
      return entries
        .map((entry) => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`)
        .join('\n');
    },
  };
}
