import { exec } from 'child_process';
import type { ToolDefinition } from '../../../shared/types.js';

export function createBashTool(): ToolDefinition {
  return {
    name: 'bash',
    description: '在 shell 中同步执行命令并返回输出',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell 命令' },
      },
      required: ['command'],
    },
    execute: async (input) => {
      const command = String(input.command);
      return new Promise<string>((resolve) => {
        exec(command, { timeout: 30_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            const output = [stdout, stderr].filter(Boolean).join('\n').trim();
            resolve(output || `exit code ${error.code ?? 1}: ${error.message}`);
            return;
          }
          resolve(stdout);
        });
      });
    },
  };
}
