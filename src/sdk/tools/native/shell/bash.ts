import type { ToolDefinition } from '../../../shared/types.js';

export function createBashTool(): ToolDefinition {
  return {
    name: 'bash',
    description: '同步执行短命令的占位工具，当前仍使用模拟输出',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell 命令' },
      },
      required: ['command'],
    },
    execute: async (input) => `[模拟同步] $ ${String(input.command)}\n(ok)`,
  };
}
