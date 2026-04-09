/**
 * Stage 15: Agent Teams（多代理团队）
 *
 * 区别于 s04 的一次性子代理（spawn → execute → destroy）：
 * 团队成员是持久代理（spawn → work → idle → work → shutdown）
 *
 * 架构层次：
 * 1. MessageBus: JSONL inbox 文件（.team/inbox/alice.jsonl）
 * 2. TeammateManager: 持久注册表 + 工作循环
 * 3. 独立循环：每个成员先排空 inbox，再处理任务
 *
 * 学习要点：
 * - 持久代理 vs 一次性子代理
 * - 消息总线（MessageBus）
 * - 团队配置持久化
 */

import type Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'fs';
import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';
import type { Tool } from '../core/types.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

type MemberStatus = 'idle' | 'working' | 'shutdown';

interface TeamMember {
  name: string;
  role: string;
  status: MemberStatus;
}

interface MessageEnvelope {
  type: 'message';
  from: string;
  content: string;
  timestamp: number;
}

// ============ MessageBus ============

class MessageBus {
  private inboxDir: string;

  constructor(teamDir: string) {
    this.inboxDir = join(teamDir, 'inbox');
  }

  async init() {
    if (!existsSync(this.inboxDir)) {
      await mkdir(this.inboxDir, { recursive: true });
    }
  }

  async send(to: string, envelope: MessageEnvelope) {
    const file = join(this.inboxDir, `${to}.jsonl`);
    await appendFile(file, `${JSON.stringify(envelope)}\n`, 'utf-8');
  }

  async readInbox(name: string): Promise<MessageEnvelope[]> {
    const file = join(this.inboxDir, `${name}.jsonl`);
    if (!existsSync(file)) return [];
    const raw = await readFile(file, 'utf-8');
    const messages = raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    // 清空 inbox
    await writeFile(file, '', 'utf-8');
    return messages;
  }
}

// ============ TeammateManager ============

class TeammateManager {
  private members = new Map<string, TeamMember>();
  private bus: MessageBus;
  private teamDir: string;

  constructor(teamDir: string) {
    this.teamDir = teamDir;
    this.bus = new MessageBus(teamDir);
  }

  async init() {
    if (!existsSync(this.teamDir)) {
      await mkdir(this.teamDir, { recursive: true });
    }
    await this.bus.init();
  }

  spawn(name: string, role: string): TeamMember {
    const member: TeamMember = { name, role, status: 'idle' };
    this.members.set(name, member);
    return member;
  }

  getMember(name: string): TeamMember | undefined {
    return this.members.get(name);
  }

  listMembers(): TeamMember[] {
    return Array.from(this.members.values());
  }

  async sendMessage(from: string, to: string, content: string) {
    const envelope: MessageEnvelope = { type: 'message', from, content, timestamp: Date.now() };
    await this.bus.send(to, envelope);
  }

  async readInbox(name: string): Promise<MessageEnvelope[]> {
    return this.bus.readInbox(name);
  }

  /** 模拟团队成员独立工作循环 */
  async runMemberLoop(name: string, task: string): Promise<string> {
    const member = this.members.get(name);
    if (!member) return `成员 ${name} 不存在`;

    member.status = 'working';
    console.log(`  🧑‍💻 ${name} (${member.role}) 开始工作: ${task}`);

    // 先检查 inbox
    const messages = await this.readInbox(name);
    let context = '';
    if (messages.length > 0) {
      context = messages.map((m) => `[来自 ${m.from}]: ${m.content}`).join('\n');
      console.log(`  📨 ${name} 收到 ${messages.length} 条消息`);
    }

    // 独立 Claude 调用
    const prompt = context
      ? `你是团队成员 ${name}（角色：${member.role}）。\n\n收到消息:\n${context}\n\n任务: ${task}`
      : `你是团队成员 ${name}（角色：${member.role}）。任务: ${task}`;

    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 1024,
      system: `你是 ${name}，角色是 ${member.role}。请简洁地完成任务，控制在 150 字以内。`,
      messages: [{ role: 'user', content: prompt }],
    });

    const result = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    member.status = 'idle';
    console.log(`  ✅ ${name} 完成工作\n`);
    return result;
  }

  getBus(): MessageBus {
    return this.bus;
  }
}

// ============ 工具定义 ============

function createTeamTools(manager: TeammateManager): Tool[] {
  return [
    {
      name: 'spawn_teammate',
      description: '创建一个持久团队成员',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '成员名' },
          role: { type: 'string', description: '角色（如 coder, reviewer, tester）' },
        },
        required: ['name', 'role'],
      },
      execute: async (params) => {
        const member = manager.spawn(params.name as string, params.role as string);
        return `团队成员已创建: ${member.name} (${member.role})`;
      },
    },
    {
      name: 'send_message',
      description: '向团队成员发送消息',
      input_schema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: '发送者' },
          to: { type: 'string', description: '接收者' },
          content: { type: 'string', description: '消息内容' },
        },
        required: ['from', 'to', 'content'],
      },
      execute: async (params) => {
        await manager.sendMessage(
          params.from as string,
          params.to as string,
          params.content as string,
        );
        return `消息已发送: ${params.from} → ${params.to}`;
      },
    },
    {
      name: 'assign_work',
      description: '分配任务给团队成员并等待结果',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '成员名' },
          task: { type: 'string', description: '任务描述' },
        },
        required: ['name', 'task'],
      },
      execute: async (params) => {
        const result = await manager.runMemberLoop(params.name as string, params.task as string);
        return `${params.name} 的结果:\n${result}`;
      },
    },
    {
      name: 'list_team',
      description: '列出所有团队成员',
      input_schema: { type: 'object', properties: {} },
      execute: async () => {
        const members = manager.listMembers();
        if (members.length === 0) return '团队为空';
        return members
          .map(
            (m) => `  ${m.status === 'working' ? '🔄' : '💤'} ${m.name} (${m.role}) - ${m.status}`,
          )
          .join('\n');
      },
    },
  ];
}

// ============ 代理循环 ============

const SYSTEM_PROMPT = `你是一个团队主管（lead），可以创建和协调团队成员。

工具：
- spawn_teammate: 创建成员
- send_message: 发消息
- assign_work: 分配任务并获取结果
- list_team: 查看团队

请根据用户需求组建团队，分配工作，协调结果。`;

async function agentLoopWithTeam(userInput: string) {
  const teamDir = join(process.cwd(), '.team');
  const manager = new TeammateManager(teamDir);
  await manager.init();

  console.log('🤖 启动团队协作代理...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const tools = createTeamTools(manager);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userInput }];
  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  let continueLoop = true;
  let loopCount = 0;

  while (continueLoop && loopCount < 12) {
    loopCount++;
    console.log(`🔄 循环 ${loopCount}...\n`);

    const response = await client.messages.create({
      model: appConfig.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools: anthropicTools,
    });
    console.log(`📊 Stop reason: ${response.stop_reason}\n`);
    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'text') console.log(`🤖 Lead: ${block.text}\n`);
      else if (block.type === 'tool_use') {
        console.log(`🔧 ${block.name}:`, JSON.stringify(block.input, null, 2), '\n');
        const tool = tools.find((t) => t.name === block.name);
        if (tool) {
          const result = await tool.execute(block.input as Record<string, unknown>);
          console.log(`✅ ${result}\n`);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
      }
    }
    if (toolResults.length > 0) messages.push({ role: 'user', content: toolResults });
    continueLoop = response.stop_reason === 'tool_use';
    if (response.stop_reason === 'end_turn') console.log('✅ 对话结束\n');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Stage 15: Agent Teams 示例 ===\n');
  await agentLoopWithTeam(
    '请组建一个 3 人小团队（coder、reviewer、tester），让 coder 写一个排序函数，reviewer 审查，tester 设计测试用例。',
  );
}

export type { MessageEnvelope, TeamMember };
export { agentLoopWithTeam, MessageBus, TeammateManager };
