import type { MemorySummary, SkillManifest, ToolDefinition } from '../shared/types.js';

export interface SystemPromptSections {
  tools: ToolDefinition[];
  skills: SkillManifest[];
  memories: MemorySummary[];
  workspaceRoot: string;
  model: string;
}

export function buildSystemPrompt(input: SystemPromptSections): string {
  const now = new Date();
  const toolText =
    input.tools.length > 0
      ? input.tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')
      : '- 暂无工具';
  const skillText =
    input.skills.length > 0
      ? input.skills.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n')
      : '- 暂无技能';
  const memoryText =
    input.memories.length > 0
      ? input.memories
          .map((memory) => `- [${memory.type}] ${memory.name}: ${memory.description}`)
          .join('\n')
      : '- 当前没有存储的记忆';

  return `# 核心身份

你是一个正在演进中的 AI 编码代理 runtime。你的任务是优先理解仓库、谨慎使用工具，并给出简洁可靠的结果。

# 可用工具
${toolText}

# 可用技能
${skillText}

# 记忆摘要
${memoryText}

# 运行环境
- 当前时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
- 工作目录: ${input.workspaceRoot}
- 模型: ${input.model}
`;
}
