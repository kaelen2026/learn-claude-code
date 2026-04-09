import type { ToolDefinition } from '../../../shared/types.js';
import type { SubagentManager } from '../../../capabilities/subagents/subagent-manager.js';

export function createListSubagentResultsTool(manager: SubagentManager): ToolDefinition {
  return {
    name: 'list_results',
    description: '列出所有已完成的子代理结果',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const results = manager.listResults();
      if (results.length === 0) return '暂无子代理结果';
      return results
        .map(
          (result) =>
            `📋 子代理 #${result.id}\n   任务: ${result.task}\n   结果: ${result.result.slice(0, 200)}`
        )
        .join('\n---\n');
    },
  };
}
