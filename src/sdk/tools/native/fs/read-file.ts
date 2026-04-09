import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolveWorkspacePath } from '../../../shared/path-safety.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createReadFileTool(workspaceRoot: string): ToolDefinition {
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
      const requestedPath = String(input.path || '');
      const resolved = await resolveWorkspacePath(workspaceRoot, requestedPath, 'file');
      if (!resolved.ok || !resolved.path) {
        return resolved.error || `无效文件路径: ${requestedPath}`;
      }

      if (!existsSync(resolved.path)) {
        return `文件不存在: ${requestedPath}`;
      }

      const content = await readFile(resolved.path, 'utf-8');
      return content.slice(0, 4000);
    },
  };
}
