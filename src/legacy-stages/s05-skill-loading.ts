/**
 * Stage 05: Skill Loading（技能加载）
 *
 * 两层技能加载模型：
 * 1. 轻量发现层：system prompt 只放技能目录（名称 + 简要描述）
 * 2. 按需深加载层：模型需要时才加载完整技能正文（SKILL.md body）
 *
 * 核心思想：不是把所有知识永远塞进 prompt，而是在需要的时候再加载正确那一份。
 *
 * 三个核心数据结构：
 * - SkillManifest: 轻量元信息（name + description）
 * - SkillDocument: 完整技能（manifest + body）
 * - SkillRegistry: 统一注册表（发现 + 加载）
 *
 * 学习要点：
 * - SKILL.md frontmatter 解析
 * - 两层加载模型设计
 * - 动态注入上下文
 */

import Anthropic from '@anthropic-ai/sdk';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { Tool } from '../core/types.js';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

/** 轻量元信息 —— 始终在 system prompt 中 */
interface SkillManifest {
  name: string;
  description: string;
}

/** 完整技能文档 —— 按需加载 */
interface SkillDocument {
  manifest: SkillManifest;
  body: string;
}

// ============ SkillRegistry ============

class SkillRegistry {
  private skillsDir: string;
  private manifests: SkillManifest[] = [];
  private loaded = new Map<string, SkillDocument>();

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  /**
   * 发现所有技能：扫描 skills/ 目录，解析每个 SKILL.md 的 frontmatter
   */
  async discover(): Promise<SkillManifest[]> {
    const entries = await readdir(this.skillsDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    this.manifests = [];
    for (const dir of dirs) {
      const skillFile = join(this.skillsDir, dir.name, 'SKILL.md');
      try {
        const content = await readFile(skillFile, 'utf-8');
        const manifest = this.parseFrontmatter(content);
        if (manifest) {
          this.manifests.push(manifest);
        }
      } catch {
        // 跳过无效的技能目录
      }
    }

    return this.manifests;
  }

  /**
   * 深加载：读取完整 SKILL.md，返回 body 正文
   */
  async load(name: string): Promise<SkillDocument | null> {
    if (this.loaded.has(name)) {
      return this.loaded.get(name)!;
    }

    const skillFile = join(this.skillsDir, name, 'SKILL.md');
    try {
      const content = await readFile(skillFile, 'utf-8');
      const manifest = this.parseFrontmatter(content);
      if (!manifest) return null;

      const body = this.extractBody(content);
      const doc: SkillDocument = { manifest, body };
      this.loaded.set(name, doc);
      return doc;
    } catch {
      return null;
    }
  }

  /** 获取所有已发现的 manifest */
  getManifests(): SkillManifest[] {
    return this.manifests;
  }

  /** 获取已加载的技能名列表 */
  getLoadedNames(): string[] {
    return Array.from(this.loaded.keys());
  }

  /**
   * 生成技能目录文本 —— 用于注入 system prompt
   */
  describeAvailable(): string {
    if (this.manifests.length === 0) return '暂无可用技能。';
    return this.manifests
      .map((m) => {
        const status = this.loaded.has(m.name) ? '✅ 已加载' : '📦 可加载';
        return `- ${status} [${m.name}] ${m.description}`;
      })
      .join('\n');
  }

  // ---- 内部方法 ----

  private parseFrontmatter(content: string): SkillManifest | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const frontmatter = match[1];
    const name = this.extractField(frontmatter, 'name');
    const description = this.extractField(frontmatter, 'description');

    if (!name || !description) return null;
    return { name, description };
  }

  private extractField(text: string, field: string): string | null {
    const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  }

  private extractBody(content: string): string {
    // 去掉 frontmatter，返回正文
    return content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
  }
}

// ============ 工具定义 ============

function createTools(registry: SkillRegistry): Tool[] {
  const loadSkillTool: Tool = {
    name: 'load_skill',
    description: '按需加载一个技能的完整内容。加载后你将获得该技能的详细指南。',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '技能名称',
        },
      },
      required: ['name'],
    },
    execute: async (params) => {
      const name = params.name as string;
      const doc = await registry.load(name);
      if (!doc) {
        const available = registry.getManifests().map((m) => m.name).join(', ');
        return `错误: 技能 "${name}" 不存在。可用技能: ${available}`;
      }
      return `=== 技能已加载: ${doc.manifest.name} ===\n\n${doc.body}`;
    },
  };

  return [loadSkillTool];
}

// ============ 代理循环 ============

function buildSystemPrompt(registry: SkillRegistry): string {
  const now = new Date();
  const currentTime = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

  return `你是一个可扩展的 AI 助手，支持按需加载技能模块。

## 当前时间
${currentTime}，星期${weekday}（Asia/Shanghai）

## 可用技能目录
${registry.describeAvailable()}

## 工作流程
1. 查看上方的技能目录，判断用户请求需要哪个技能
2. 使用 load_skill 工具加载需要的技能
3. 技能加载后，你会收到该技能的完整指南，请按指南行事
4. 完成用户的请求

注意：
- 只加载你需要的技能，不要全部加载
- 技能正文是你的行动指南，请仔细阅读后再回答`;
}

async function agentLoopWithSkills(userInput: string) {
  console.log('🤖 启动可扩展代理（两层技能加载）...\n');
  console.log(`👤 用户: ${userInput}\n`);

  // 初始化技能注册表
  const skillsDir = join(process.cwd(), 'skills');
  const registry = new SkillRegistry(skillsDir);
  const manifests = await registry.discover();
  console.log(`📦 发现 ${manifests.length} 个技能:`);
  manifests.forEach((m) => console.log(`   - ${m.name}: ${m.description}`));
  console.log();

  const tools = createTools(registry);
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userInput },
  ];

  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 10;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    console.log(`🔄 循环 ${loopCount}...\n`);

    // 每次循环用最新的 system prompt（反映已加载状态）
    const systemPrompt = buildSystemPrompt(registry);

    const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));

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
          console.log(`✅ 技能内容已注入 (${result.length} 字符)\n`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `错误: 工具 "${block.name}" 不可用`,
            is_error: true,
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

  if (loopCount >= maxLoops) {
    console.log('⚠️  达到最大循环次数\n');
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 05: Skill Loading 示例 ===\n');

  await agentLoopWithSkills(
    '请帮我计算 (15 + 27) * 3 - 18 / 2 的结果，并告诉我今天是星期几。'
  );
}

export { agentLoopWithSkills, SkillRegistry };
export type { SkillManifest, SkillDocument };
