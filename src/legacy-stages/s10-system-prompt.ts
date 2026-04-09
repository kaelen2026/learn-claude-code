/**
 * Stage 10: System Prompt（系统提示词）
 *
 * 系统提示词不是一整块硬编码文本，而是一条可维护的组装流水线。
 *
 * 六段最小心智模型：
 * core + tools + skills + memory + claude_md + dynamic_context = final system prompt
 *
 * 1. 核心身份和行为说明（稳定）
 * 2. 工具列表（半稳定，工具集可能变化）
 * 3. Skills 元信息（半稳定，技能可能动态加载）
 * 4. Memory 内容（跨会话持久）
 * 5. CLAUDE.md 指令链（用户全局 → 项目 → 子目录）
 * 6. 动态环境信息（每轮可能变化）
 *
 * 关键边界：
 * - 稳定 vs 动态：稳定系统说明与每轮变化的提醒应分离
 * - system prompt vs system reminder：prompt 放身份规则，reminder 放临时上下文
 *
 * 学习要点：
 * - 提示词构建器模式
 * - 模板字符串组装
 * - 配置管理与优先级链
 */

import type Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';
import type { Tool } from '../core/types.js';

const client = createAnthropicClient();

// ============ DYNAMIC_BOUNDARY 标记 ============

const DYNAMIC_BOUNDARY = '\n<!-- DYNAMIC_BOUNDARY -->\n';

// ============ SystemPromptBuilder ============

class SystemPromptBuilder {
  private tools: Tool[] = [];
  private skillsDir: string;
  private memoryDir: string;
  private projectDir: string;

  constructor(
    options: {
      tools?: Tool[];
      skillsDir?: string;
      memoryDir?: string;
      projectDir?: string;
    } = {},
  ) {
    this.tools = options.tools || [];
    this.skillsDir = options.skillsDir || join(process.cwd(), 'skills');
    this.memoryDir = options.memoryDir || join(process.cwd(), '.memory');
    this.projectDir = options.projectDir || process.cwd();
  }

  /** 段 1：核心身份和行为说明 */
  private buildCore(): string {
    return `# 核心身份

你是 Claude，一个 AI 编码助手。你帮助用户完成软件工程任务，包括编写代码、调试、重构和解释代码。

## 行为准则
- 先理解现有代码再提出修改建议
- 优先编辑现有文件而非创建新文件
- 保持代码安全，避免引入安全漏洞
- 不添加超出要求的功能
- 输出简洁直接，先给出答案再解释`;
  }

  /** 段 2：工具列表 */
  private buildToolListing(): string {
    if (this.tools.length === 0) return '';

    const toolDescriptions = this.tools.map((t) => `- **${t.name}**: ${t.description}`).join('\n');

    return `# 可用工具

${toolDescriptions}`;
  }

  /** 段 3：Skills 元信息 */
  private async buildSkillListing(): Promise<string> {
    if (!existsSync(this.skillsDir)) return '';

    try {
      const entries = await readdir(this.skillsDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory());

      const skills: Array<{ name: string; description: string }> = [];
      for (const dir of dirs) {
        const skillFile = join(this.skillsDir, dir.name, 'SKILL.md');
        if (!existsSync(skillFile)) continue;
        const content = await readFile(skillFile, 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) continue;
        const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
        const desc = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
        if (name && desc) skills.push({ name, description: desc });
      }

      if (skills.length === 0) return '';
      const listing = skills.map((s) => `- **${s.name}**: ${s.description}`).join('\n');
      return `# 可用技能

使用 load_skill 工具加载需要的技能。

${listing}`;
    } catch {
      return '';
    }
  }

  /** 段 4：Memory 内容 */
  private async buildMemorySection(): Promise<string> {
    if (!existsSync(this.memoryDir)) return '';

    try {
      const files = await readdir(this.memoryDir);
      const memoryFiles = files.filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');

      if (memoryFiles.length === 0) return '';

      const entries: string[] = [];
      for (const file of memoryFiles) {
        const content = await readFile(join(this.memoryDir, file), 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) continue;
        const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
        const type = match[1].match(/^type:\s*(.+)$/m)?.[1]?.trim();
        const desc = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
        if (name && type && desc) {
          entries.push(`- [${type}] **${name}**: ${desc}`);
        }
      }

      if (entries.length === 0) return '';
      return `# 记忆

以下是跨会话存储的信息（记忆提供方向，当前观察优先于存储事实）：

${entries.join('\n')}`;
    } catch {
      return '';
    }
  }

  /** 段 5：CLAUDE.md 指令链（用户全局 → 项目 → 子目录） */
  private async buildClaudeMd(): Promise<string> {
    const paths = [
      join(process.env.HOME || '~', '.claude', 'CLAUDE.md'), // 用户全局
      join(this.projectDir, 'CLAUDE.md'), // 项目根目录
      join(this.projectDir, '.claude', 'CLAUDE.md'), // 项目 .claude 目录
    ];

    const sections: string[] = [];
    const labels = ['用户全局', '项目', '项目 .claude'];

    for (let i = 0; i < paths.length; i++) {
      if (!existsSync(paths[i])) continue;
      try {
        const content = await readFile(paths[i], 'utf-8');
        if (content.trim()) {
          sections.push(`## ${labels[i]}指令\n\n${content.trim()}`);
        }
      } catch {
        // 跳过
      }
    }

    if (sections.length === 0) return '';
    return `# CLAUDE.md 指令\n\n${sections.join('\n\n')}`;
  }

  /** 段 6：动态环境信息 */
  private buildDynamicContext(): string {
    const now = new Date();
    const dateStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

    return `# 环境信息

- 当前时间: ${dateStr}，星期${weekday}（Asia/Shanghai）
- 工作目录: ${this.projectDir}
- 模型: ${appConfig.model}
- 平台: ${process.platform}`;
  }

  /** 组装完整 system prompt */
  async build(): Promise<string> {
    const segments: string[] = [];

    // 稳定段（不常变化）
    const core = this.buildCore();
    const toolListing = this.buildToolListing();
    const skillListing = await this.buildSkillListing();
    const memory = await this.buildMemorySection();
    const claudeMd = await this.buildClaudeMd();

    if (core) segments.push(core);
    if (toolListing) segments.push(toolListing);
    if (skillListing) segments.push(skillListing);
    if (memory) segments.push(memory);
    if (claudeMd) segments.push(claudeMd);

    // 动态段（每轮可能变化）
    segments.push(DYNAMIC_BOUNDARY);
    segments.push(this.buildDynamicContext());

    return segments.join('\n\n');
  }

  /** 构建 system reminder（临时补充上下文） */
  buildReminder(context: Record<string, string>): string {
    const lines = Object.entries(context).map(([key, value]) => `- ${key}: ${value}`);
    return `<system-reminder>\n${lines.join('\n')}\n</system-reminder>`;
  }
}

// ============ 工具定义 ============

const readFileTool: Tool = {
  name: 'read_file',
  description: '读取文件内容',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const path = params.path as string;
    if (!existsSync(path)) return `文件不存在: ${path}`;
    try {
      const content = await readFile(path, 'utf-8');
      return content.slice(0, 2000);
    } catch (error) {
      return `读取失败: ${error}`;
    }
  },
};

const writeFileTool: Tool = {
  name: 'write_file',
  description: '写入文件内容',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      content: { type: 'string', description: '写入内容' },
    },
    required: ['path', 'content'],
  },
  execute: async (params) => {
    return `[模拟] 已写入: ${params.path} (${(params.content as string).length} 字符)`;
  },
};

const editFileTool: Tool = {
  name: 'edit_file',
  description: '编辑文件中的指定内容（查找并替换）',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      old_string: { type: 'string', description: '要替换的内容' },
      new_string: { type: 'string', description: '替换后的内容' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  execute: async (params) => {
    return `[模拟] 已编辑: ${params.path}`;
  },
};

const bashTool: Tool = {
  name: 'bash',
  description: '执行 bash 命令',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell 命令' },
    },
    required: ['command'],
  },
  execute: async (params) => {
    return `[模拟] $ ${params.command}\n(ok)`;
  },
};

// ============ 代理循环 ============

const tools: Tool[] = [readFileTool, writeFileTool, editFileTool, bashTool];

async function agentLoopWithSystemPrompt(userInput: string) {
  console.log('🤖 启动系统提示词组装演示...\n');

  // 构建 system prompt
  const builder = new SystemPromptBuilder({
    tools,
    skillsDir: join(process.cwd(), 'skills'),
    memoryDir: join(process.cwd(), '.memory'),
    projectDir: process.cwd(),
  });

  const systemPrompt = await builder.build();

  // 展示组装结果
  console.log('=== 组装后的 System Prompt ===\n');
  console.log(systemPrompt);
  console.log('\n=== System Prompt 结束 ===\n');
  console.log(`📊 总长度: ${systemPrompt.length} 字符\n`);

  // 展示 system reminder 示例
  const reminder = builder.buildReminder({
    当前分支: 'feature/add-auth',
    未提交文件: 'src/auth.ts, src/middleware.ts',
    'CI 状态': '通过',
  });
  console.log('=== System Reminder 示例 ===\n');
  console.log(reminder);
  console.log('\n=== Reminder 结束 ===\n');

  // 运行代理循环
  console.log(`👤 用户: ${userInput}\n`);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userInput }];

  const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));

  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 10;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    console.log(`🔄 循环 ${loopCount}...\n`);

    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: anthropicTools,
    });

    console.log(`📊 Stop reason: ${response.stop_reason}\n`);

    messages.push({
      role: 'assistant',
      content: response.content,
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`🤖 Claude: ${block.text}\n`);
      } else if (block.type === 'tool_use') {
        console.log(`🔧 调用工具: ${block.name}`);
        console.log(`📝 参数:`, JSON.stringify(block.input, null, 2), '\n');

        const tool = tools.find((t) => t.name === block.name);
        if (tool) {
          const result = await tool.execute(block.input as Record<string, unknown>);
          console.log(`✅ 结果: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}\n`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }

    if (response.stop_reason === 'end_turn') {
      continueLoop = false;
      console.log('✅ 对话结束\n');
    } else if (response.stop_reason === 'tool_use') {
      continueLoop = true;
      console.log('🔄 继续处理...\n');
    }
  }
}

// ============ 演示 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 10: System Prompt 示例 ===\n');

  await agentLoopWithSystemPrompt('请读取 package.json 文件，然后告诉我这个项目用了哪些依赖。');
}

export { DYNAMIC_BOUNDARY, SystemPromptBuilder };
