import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { resolveWorkspacePath } from '../../../shared/path-safety.js';
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
      const requestedPath = String(input.path || '.');
      const resolved = resolveWorkspacePath(workspaceRoot, requestedPath, 'directory');
      if (!resolved.ok || !resolved.path) {
        return resolved.error || `无效目录路径: ${requestedPath}`;
      }

      if (!existsSync(resolved.path)) {
        return `目录不存在: ${requestedPath}`;
      }

      const entries = await readdir(resolved.path, { withFileTypes: true });
      return entries
        .map((entry) => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`)
        .join('\n');
    },
  };
}
