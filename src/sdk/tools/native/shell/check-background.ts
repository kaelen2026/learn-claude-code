import type { BackgroundManager } from '../../../capabilities/background/background-manager.js';
import type { ToolDefinition } from '../../../shared/types.js';

export function createCheckBackgroundTool(manager: BackgroundManager): ToolDefinition {
  return {
    name: 'check_background',
    description: '检查后台任务状态，不传 task_id 时返回全部',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '后台任务 ID' },
      },
    },
    execute: async (input) => {
      if (input.task_id) {
        const task = await manager.check(String(input.task_id));
        if (!task) return `未找到任务: ${String(input.task_id)}`;
        return formatRuntimeTask(task);
      }

      const tasks = await manager.listAll();
      if (tasks.length === 0) return '当前没有后台任务';
      return tasks.map(formatRuntimeTask).join('\n---\n');
    },
  };
}

function formatRuntimeTask(task: {
  id: string;
  command: string;
  status: string;
  startedAt: number;
  resultPreview: string;
  outputFile: string;
}): string {
  const icon = { running: '🔄', completed: '✅', failed: '❌' }[task.status] || '•';
  const elapsed = Math.round((Date.now() - task.startedAt) / 1000);
  const lines = [
    `${icon} ${task.id}: ${task.command}`,
    `   状态: ${task.status} | 已运行: ${elapsed}s`,
  ];
  if (task.resultPreview) {
    lines.push(`   预览: ${task.resultPreview.slice(0, 100)}...`);
  }
  if (task.outputFile) {
    lines.push(`   完整输出: ${task.outputFile}`);
  }
  return lines.join('\n');
}
