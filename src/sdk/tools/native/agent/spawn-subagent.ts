import type { ToolDefinition } from '../../../shared/types.js';
import type { SubagentManager } from '../../../capabilities/subagents/subagent-manager.js';

export function createSpawnSubagentTool(manager: SubagentManager): ToolDefinition {
  return {
    name: 'spawn_subagent',
    description: '创建一个一次性子代理处理子任务',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: '子任务描述' },
        context: { type: 'string', description: '可选上下文' },
      },
      required: ['task'],
    },
    execute: async (input) => {
      const result = await manager.run(
        String(input.task),
        input.context ? String(input.context) : ''
      );
      return `子代理 #${result.id} 完成任务: "${result.task}"\n\n结果:\n${result.result}`;
    },
  };
}
