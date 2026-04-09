/**
 * Stage 09: Memory System（记忆系统）
 *
 * 保留"跨会话存活、无法从当前代码轻易推导出"的信息。
 *
 * 存储结构：
 * .memory/
 * ├── MEMORY.md      (索引文件，200 行上限)
 * ├── user_*.md      (用户偏好)
 * ├── feedback_*.md  (反馈纠正)
 * ├── project_*.md   (项目决策)
 * └── reference_*.md (外部资源)
 *
 * 四种记忆类型：
 * - user: 用户偏好（代码风格、响应方式）
 * - feedback: 显式纠正（"不要做 X"）
 * - project: 非显而易见的项目约定或决策
 * - reference: 外部资源指针（仪表盘、工单系统 URL）
 *
 * 不应存储的内容：
 * - 文件结构、函数签名（可从代码推导）
 * - 当前任务进度、分支名（临时状态）
 * - 密钥凭证
 *
 * 学习要点：
 * - 文件系统操作（fs/promises）
 * - YAML frontmatter 解析
 * - 记忆索引和搜索
 * - System prompt 注入
 */

import type Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';
import type { Tool } from '../core/types.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

interface MemoryEntry {
  name: string;
  description: string;
  type: MemoryType;
  filename: string;
  body: string;
}

// ============ MemoryManager ============

class MemoryManager {
  private memoryDir: string;
  private indexFile: string;
  private readonly INDEX_LINE_CAP = 200;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
    this.indexFile = join(memoryDir, 'MEMORY.md');
  }

  /** 初始化记忆目录 */
  async init() {
    if (!existsSync(this.memoryDir)) {
      await mkdir(this.memoryDir, { recursive: true });
    }
    if (!existsSync(this.indexFile)) {
      await writeFile(this.indexFile, '# Memory Index\n', 'utf-8');
    }
  }

  /** 保存一条记忆 */
  async save(entry: Omit<MemoryEntry, 'filename'>): Promise<string> {
    await this.init();

    // 生成文件名
    const slug = entry.name
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '')
      .slice(0, 40);
    const filename = `${entry.type}_${slug}.md`;
    const filepath = join(this.memoryDir, filename);

    // 写入带 frontmatter 的记忆文件
    const content = [
      '---',
      `name: ${entry.name}`,
      `description: ${entry.description}`,
      `type: ${entry.type}`,
      '---',
      '',
      entry.body,
    ].join('\n');

    await writeFile(filepath, content, 'utf-8');

    // 重建索引
    await this.rebuildIndex();

    return filename;
  }

  /** 加载所有记忆 */
  async loadAll(): Promise<MemoryEntry[]> {
    await this.init();
    const files = await readdir(this.memoryDir);
    const memoryFiles = files.filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');

    const entries: MemoryEntry[] = [];
    for (const file of memoryFiles) {
      const entry = await this.loadFile(file);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  /** 按关键字搜索记忆 */
  async search(query: string): Promise<MemoryEntry[]> {
    const all = await this.loadAll();
    const lower = query.toLowerCase();
    return all.filter(
      (e) =>
        e.name.toLowerCase().includes(lower) ||
        e.description.toLowerCase().includes(lower) ||
        e.body.toLowerCase().includes(lower),
    );
  }

  /** 按类型过滤记忆 */
  async findByType(type: MemoryType): Promise<MemoryEntry[]> {
    const all = await this.loadAll();
    return all.filter((e) => e.type === type);
  }

  /** 删除一条记忆 */
  async delete(filename: string): Promise<boolean> {
    const filepath = join(this.memoryDir, filename);
    if (!existsSync(filepath)) return false;
    await unlink(filepath);
    await this.rebuildIndex();
    return true;
  }

  /** 重建 MEMORY.md 索引 */
  async rebuildIndex() {
    const entries = await this.loadAll();
    const lines = ['# Memory Index', ''];

    const byType = new Map<MemoryType, MemoryEntry[]>();
    for (const entry of entries) {
      if (!byType.has(entry.type)) byType.set(entry.type, []);
      byType.get(entry.type)!.push(entry);
    }

    const typeLabels: Record<MemoryType, string> = {
      user: '用户偏好',
      feedback: '反馈纠正',
      project: '项目决策',
      reference: '外部资源',
    };

    for (const [type, label] of Object.entries(typeLabels)) {
      const items = byType.get(type as MemoryType) || [];
      if (items.length === 0) continue;
      lines.push(`## ${label}`);
      for (const item of items) {
        lines.push(`- [${item.name}](${item.filename}) — ${item.description}`);
      }
      lines.push('');
    }

    // 截断到 INDEX_LINE_CAP
    const truncated = lines.slice(0, this.INDEX_LINE_CAP);
    await writeFile(this.indexFile, truncated.join('\n'), 'utf-8');
  }

  /** 生成注入 system prompt 的记忆摘要 */
  async buildPromptSection(): Promise<string> {
    const entries = await this.loadAll();
    if (entries.length === 0) return '当前没有存储的记忆。';

    const lines = [`已存储 ${entries.length} 条记忆：`];
    for (const entry of entries) {
      lines.push(`- [${entry.type}] ${entry.name}: ${entry.description}`);
    }
    return lines.join('\n');
  }

  // ---- 内部方法 ----

  private async loadFile(filename: string): Promise<MemoryEntry | null> {
    const filepath = join(this.memoryDir, filename);
    try {
      const raw = await readFile(filepath, 'utf-8');
      return this.parseFrontmatter(raw, filename);
    } catch {
      return null;
    }
  }

  private parseFrontmatter(content: string, filename: string): MemoryEntry | null {
    const match = content.match(/^---\n([\s\S]*?)\n---\n*([\s\S]*)$/);
    if (!match) return null;

    const frontmatter = match[1];
    const body = match[2].trim();

    const name = this.extractField(frontmatter, 'name');
    const description = this.extractField(frontmatter, 'description');
    const type = this.extractField(frontmatter, 'type') as MemoryType;

    if (!name || !description || !type) return null;
    return { name, description, type, filename, body };
  }

  private extractField(text: string, field: string): string | null {
    const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  }
}

// ============ 工具定义 ============

function createMemoryTools(manager: MemoryManager): Tool[] {
  const saveMemoryTool: Tool = {
    name: 'save_memory',
    description: '保存一条记忆。用于记录跨会话有用的信息（用户偏好、反馈、项目决策、外部资源）。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '记忆名称（简短标题）' },
        description: { type: 'string', description: '一行描述（用于索引和搜索）' },
        type: {
          type: 'string',
          description:
            '记忆类型: user(用户偏好), feedback(反馈纠正), project(项目决策), reference(外部资源)',
        },
        body: { type: 'string', description: '记忆正文内容' },
      },
      required: ['name', 'description', 'type', 'body'],
    },
    execute: async (params) => {
      const filename = await manager.save({
        name: params.name as string,
        description: params.description as string,
        type: params.type as MemoryType,
        body: params.body as string,
      });
      return `记忆已保存: ${filename}`;
    },
  };

  const searchMemoryTool: Tool = {
    name: 'search_memory',
    description: '搜索已保存的记忆，按关键字匹配',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键字' },
      },
      required: ['query'],
    },
    execute: async (params) => {
      const results = await manager.search(params.query as string);
      if (results.length === 0) return `未找到匹配 "${params.query}" 的记忆`;
      return results
        .map((e) => `[${e.type}] ${e.name}\n  ${e.description}\n  ${e.body.slice(0, 200)}`)
        .join('\n---\n');
    },
  };

  const listMemoriesTool: Tool = {
    name: 'list_memories',
    description: '列出所有已保存的记忆，可按类型过滤',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: '按类型过滤: user, feedback, project, reference（不传则返回全部）',
        },
      },
    },
    execute: async (params) => {
      const entries = params.type
        ? await manager.findByType(params.type as MemoryType)
        : await manager.loadAll();
      if (entries.length === 0) return '当前没有存储的记忆';
      return entries
        .map((e) => `📝 [${e.type}] ${e.name} (${e.filename})\n   ${e.description}`)
        .join('\n');
    },
  };

  const deleteMemoryTool: Tool = {
    name: 'delete_memory',
    description: '删除一条记忆',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: '要删除的记忆文件名' },
      },
      required: ['filename'],
    },
    execute: async (params) => {
      const deleted = await manager.delete(params.filename as string);
      return deleted ? `记忆已删除: ${params.filename}` : `未找到记忆: ${params.filename}`;
    },
  };

  return [saveMemoryTool, searchMemoryTool, listMemoriesTool, deleteMemoryTool];
}

// ============ 代理循环 ============

const SYSTEM_PROMPT_BASE = `你是一个具有持久记忆的 AI 编码助手。

你可以通过记忆工具保存和检索跨会话有用的信息：
- save_memory: 保存新记忆（类型: user/feedback/project/reference）
- search_memory: 搜索已有记忆
- list_memories: 列出所有记忆
- delete_memory: 删除过时的记忆

## 什么应该存储
- 用户偏好（代码风格、沟通方式）
- 用户的纠正和反馈
- 项目的非显而易见决策
- 外部资源链接

## 什么不应该存储
- 可从代码推导的信息（文件结构、函数签名）
- 临时状态（当前任务、分支名）
- 密钥凭证

记忆提供方向而非绝对真理——当前观察优先于存储的事实。`;

async function agentLoopWithMemory(userInput: string) {
  const memoryDir = join(process.cwd(), '.memory');
  const manager = new MemoryManager(memoryDir);
  await manager.init();

  console.log('🤖 启动带记忆系统的代理...\n');

  // 加载已有记忆注入 system prompt
  const memorySection = await manager.buildPromptSection();
  const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n## 当前记忆\n${memorySection}`;

  console.log(`🧠 ${memorySection}\n`);
  console.log(`👤 用户: ${userInput}\n`);

  const tools = createMemoryTools(manager);
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
          console.log(`✅ 结果: ${result}\n`);
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

  // 展示最终记忆状态
  console.log('=== 记忆系统状态 ===');
  const allMemories = await manager.loadAll();
  console.log(`总记忆数: ${allMemories.length}`);
  for (const m of allMemories) {
    console.log(`  [${m.type}] ${m.name} — ${m.description}`);
  }

  // 展示 MEMORY.md 索引
  if (existsSync(join(memoryDir, 'MEMORY.md'))) {
    const index = await readFile(join(memoryDir, 'MEMORY.md'), 'utf-8');
    console.log(`\n--- MEMORY.md ---\n${index}`);
  }
}

// ============ 演示 ============

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 09: Memory System 示例 ===\n');

  await agentLoopWithMemory(
    '请帮我记住以下信息：\n1. 我喜欢用 2 空格缩进\n2. 项目使用 Vitest 作为测试框架（团队讨论后决定的）\n3. Bug 追踪在 Linear 的 "BACKEND" 项目中\n然后列出所有已保存的记忆。',
  );
}

export type { MemoryEntry, MemoryType };
export { agentLoopWithMemory, MemoryManager };
