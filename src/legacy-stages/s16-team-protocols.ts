/**
 * Stage 16: Team Protocols（团队协议）
 *
 * 协议 vs 聊天：结构化工作流消息 vs 自由沟通
 * 协议需要 type、request_id、payload 字段用于系统追踪。
 *
 * 两个协议模板：
 * 1. Shutdown: 优雅终止，需显式批准/拒绝
 * 2. Plan Approval: 高风险操作需审批后才执行
 *
 * 状态机：pending → approved | rejected | expired
 *
 * 学习要点：
 * - 协议信封（ProtocolEnvelope）
 * - 请求记录持久化（RequestRecord）
 * - 状态机管理
 */

import type Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createAnthropicClient } from '../core/client.js';
import { appConfig } from '../core/config.js';
import type { Tool } from '../core/types.js';

const client = createAnthropicClient();

// ============ 数据结构 ============

type RequestKind = 'shutdown' | 'plan_approval';
type RequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

interface ProtocolEnvelope {
  type: string;
  requestId: string;
  from: string;
  to: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface RequestRecord {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  from: string;
  to: string;
  payload: Record<string, unknown>;
  createdAt: number;
  resolvedAt: number | null;
}

// ============ RequestStore ============

class RequestStore {
  private dir: string;

  constructor(teamDir: string) {
    this.dir = join(teamDir, 'requests');
  }

  async init() {
    if (!existsSync(this.dir)) await mkdir(this.dir, { recursive: true });
  }

  async create(
    kind: RequestKind,
    from: string,
    to: string,
    payload: Record<string, unknown>,
  ): Promise<RequestRecord> {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const record: RequestRecord = {
      id,
      kind,
      status: 'pending',
      from,
      to,
      payload,
      createdAt: Date.now(),
      resolvedAt: null,
    };
    await writeFile(join(this.dir, `${id}.json`), JSON.stringify(record, null, 2), 'utf-8');
    return record;
  }

  async get(id: string): Promise<RequestRecord | null> {
    const file = join(this.dir, `${id}.json`);
    if (!existsSync(file)) return null;
    return JSON.parse(await readFile(file, 'utf-8'));
  }

  async update(id: string, status: RequestStatus): Promise<RequestRecord | null> {
    const record = await this.get(id);
    if (!record) return null;
    record.status = status;
    record.resolvedAt = Date.now();
    await writeFile(join(this.dir, `${id}.json`), JSON.stringify(record, null, 2), 'utf-8');
    return record;
  }

  async listPending(): Promise<RequestRecord[]> {
    if (!existsSync(this.dir)) return [];
    const files = await readdir(this.dir);
    const records: RequestRecord[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const r: RequestRecord = JSON.parse(await readFile(join(this.dir, f), 'utf-8'));
      if (r.status === 'pending') records.push(r);
    }
    return records;
  }
}

// ============ 工具定义 ============

function createProtocolTools(store: RequestStore): Tool[] {
  return [
    {
      name: 'create_request',
      description: '创建协议请求（shutdown 或 plan_approval）',
      input_schema: {
        type: 'object',
        properties: {
          kind: { type: 'string', description: '请求类型: shutdown, plan_approval' },
          from: { type: 'string', description: '发起者' },
          to: { type: 'string', description: '审批者' },
          description: { type: 'string', description: '请求描述' },
        },
        required: ['kind', 'from', 'to', 'description'],
      },
      execute: async (params) => {
        const record = await store.create(
          params.kind as RequestKind,
          params.from as string,
          params.to as string,
          { description: params.description },
        );
        return `请求已创建: ${record.id} [${record.kind}] ${record.from} → ${record.to} (${record.status})`;
      },
    },
    {
      name: 'resolve_request',
      description: '批准或拒绝一个请求',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '请求 ID' },
          decision: { type: 'string', description: 'approved 或 rejected' },
        },
        required: ['id', 'decision'],
      },
      execute: async (params) => {
        const record = await store.update(params.id as string, params.decision as RequestStatus);
        if (!record) return `请求 ${params.id} 不存在`;
        return `请求 ${record.id} 已 ${record.status}: [${record.kind}] ${record.from} → ${record.to}`;
      },
    },
    {
      name: 'list_requests',
      description: '列出所有待处理的请求',
      input_schema: { type: 'object', properties: {} },
      execute: async () => {
        const pending = await store.listPending();
        if (pending.length === 0) return '没有待处理的请求';
        return pending
          .map((r) => `  ⏳ ${r.id} [${r.kind}] ${r.from} → ${r.to}: ${JSON.stringify(r.payload)}`)
          .join('\n');
      },
    },
  ];
}

// ============ 代理循环 ============

async function agentLoopWithProtocols(userInput: string) {
  const teamDir = join(process.cwd(), '.team');
  const store = new RequestStore(teamDir);
  await store.init();

  console.log('🤖 启动团队协议代理...\n');
  console.log(`👤 用户: ${userInput}\n`);

  const tools = createProtocolTools(store);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userInput }];
  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  const SYSTEM_PROMPT = `你是团队协议管理器。工具：create_request（创建审批请求）、resolve_request（批准/拒绝）、list_requests（列出待处理请求）。

协议类型：shutdown（关停审批）、plan_approval（方案审批）。
状态流转：pending → approved 或 rejected。`;

  let continueLoop = true;
  let loopCount = 0;
  while (continueLoop && loopCount < 10) {
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
      if (block.type === 'text') console.log(`🤖 Claude: ${block.text}\n`);
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
  console.log('=== Stage 16: Team Protocols 示例 ===\n');
  await agentLoopWithProtocols(
    '请演示协议系统：\n1. 创建一个 plan_approval 请求（alice 请求 lead 审批数据库迁移方案）\n2. 创建一个 shutdown 请求（bob 请求 lead 批准关停测试服务器）\n3. 列出待处理请求\n4. 批准数据库迁移，拒绝关停请求\n5. 再次列出请求确认状态',
  );
}

export type { ProtocolEnvelope, RequestKind, RequestRecord, RequestStatus };
export { agentLoopWithProtocols, RequestStore };
